# Setup guide

Follow these in order. It looks long, but it's mostly clicking through dashboards
once — after this, launching a Trivia Night or Family Feud session is just a
couple of clicks in the app.

> **Already set up and just need the day-to-day git/Supabase commands?**
> Skip to `PROJECT_CONTEXT.md`'s Commands Reference — it has the exact
> sequences confirmed from real runs, including the couple of gotchas below
> baked in (wrong working directory, `--project-ref` format, migration
> tracking mismatches, multi-device sync).

## 0. What you'll need

- A Discord account with permission to manage the DeskBuddies server (or ask
  whoever has "Manage Server" to do the Discord steps with you).
- Your Supabase account and Vercel account (you said you already have these).
- A GitHub (or other Git host) repo for this project.
- Node.js 18+ installed locally, if you want to run it on your machine before
  deploying.

---

## 1. Create the Discord application(s) + bot

**You need two separate Discord Applications for this project, not one.**
This wasn't obvious at first — a single app doing both jobs broke sign-in
from Discord's mobile in-app browser (Discord's mobile app intercepted login
as a bot-authorize flow instead of completing normal web OAuth). Keep them
separate from the start:

- **App A — the Bot.** Used only server-side, to check who's in your server
  and who has the MOD role. It never posts messages or needs to run
  continuously.
- **App B — Login only, no bot.** Used purely for the Discord OAuth sign-in
  flow that Supabase Auth drives. Has no Bot component at all.

### App A — the Bot

1. Go to https://discord.com/developers/applications → **New Application** →
   name it something like "DeskBuddies Games Bot".
2. **Bot** tab → **Add Bot** → copy the **Bot Token** (click "Reset Token" if
   you need to see it again). Keep this secret — treat it like a password.
   - You do **not** need to enable any "Privileged Gateway Intents" — the app
     only calls the REST API with the bot token, it doesn't maintain a live
     gateway connection.
3. **OAuth2 → URL Generator**: check the **bot** scope, leave permissions at 0
   (none needed), copy the generated URL, open it in your browser, and add the
   bot to the **DeskBuddies** server.
4. Turn on **Developer Mode** in Discord (User Settings → Advanced → Developer
   Mode), then:
   - Right-click the DeskBuddies server icon → **Copy Server ID** → this is your
     `DISCORD_GUILD_ID`.
   - Server Settings → Roles → right-click your MOD role → **Copy Role ID** →
     this is your `DISCORD_MOD_ROLE_ID`.

You should now have: **Bot Token**, **Guild ID**, **MOD Role ID**.

### App B — Login

1. **New Application** again → name it something like "DeskBuddies Games
   Login". **Do not add a bot to this one.**
2. **OAuth2 → General**: copy the **Client ID** and **Client Secret** — these
   are what go into Supabase in step 2, not App A's.
3. **OAuth2 → General → Redirects**: add
   `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows
   you the exact URL in step 2 if you haven't linked yet).

You should now also have: **Client ID**, **Client Secret** (from App B).

---

## 2. Set up Supabase

1. In your Supabase project: **Authentication → Sign In / Providers → Discord**
   → enable it → paste **App B's** Discord **Client ID** and **Client Secret**
   (the login-only app, not the bot). Supabase will show you the exact
   **Redirect URL** to paste back into App B's OAuth2 settings (step 1) if you
   haven't already.
2. **SQL Editor** → paste the contents of `supabase/migrations/0001_init.sql`
   → Run, then repeat in order for every later migration file
   (`0002` ... currently up to `0019`). (Or, if you use the Supabase CLI:
   `supabase link --project-ref <ref>` then `supabase db push` — but see the
   note below if you're picking up an existing project that already had
   migrations pasted manually.)

   > **If `supabase db push` ever fails with `relation "X" already exists"`**
   > on a project that already has these tables: the CLI doesn't know which
   > migrations were already applied by pasting into the SQL Editor. Fix with
   > `supabase migration repair <list every already-applied version>
   > --status applied`, then `supabase db push` again. Full command in
   > `PROJECT_CONTEXT.md`.

3. Deploy the Edge Functions. With the [Supabase CLI](https://supabase.com/docs/guides/cli)
   — install it as an npm dev dependency rather than a global tool (simpler on
   Windows, no Scoop needed):
   ```bash
   npm install -D supabase
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy verify-membership
   npx supabase functions deploy trivia-host
   npx supabase functions deploy trivia-answer
   npx supabase functions deploy get-current-question
   npx supabase functions deploy feud-host
   npx supabase functions deploy feud-play
   npx supabase functions deploy get-feud-state
   npx supabase functions deploy uno-host
   npx supabase functions deploy uno-play
   npx supabase functions deploy get-uno-state
   npx supabase functions deploy impostor-host
   npx supabase functions deploy impostor-play
   npx supabase functions deploy get-impostor-state
   npx supabase functions deploy wheel-host
   npx supabase functions deploy wheel-play
   npx supabase functions deploy get-wheel-state
   ```
   `<your-project-ref>` is the short project ID (e.g. `fixlkzjyfpcgnieorlaw`) —
   the subdomain of your project URL, **not** a folder path and **not** the
   full `https://...supabase.co` URL. Find it in **Project Settings →
   General → Reference ID**.
4. Set the Edge Function secrets (these are only ever read server-side, and
   use **App A's** (the Bot's) credentials):
   ```bash
   npx supabase secrets set DISCORD_GUILD_ID=your-guild-id
   npx supabase secrets set DISCORD_MOD_ROLE_ID=your-mod-role-id
   npx supabase secrets set DISCORD_BOT_TOKEN=your-bot-token
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
   Supabase into every Edge Function — you don't set those yourself.)
5. **Project Settings → API**: copy the **Project URL** and **anon public key**
   — you'll need these for the frontend's `.env`.
6. **Authentication → URL Configuration**: once you know your Vercel URL (step
   4 below), add it to **Site URL** and **Redirect URLs** too, including the
   `https://` scheme explicitly — a missing scheme here is a common cause of
   login silently failing. Or Discord login will only work on localhost.

---

## 3. Run it locally (optional but recommended first)

```bash
cd frontend
cp .env.example .env
# edit .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open the local URL, sign in with Discord, and confirm you land in the app (not
the "members only" screen). If you get bounced to "members only", double-check
the Guild ID/Bot Token/bot-is-in-the-server steps above.

To make yourself (or another mod) show up as a MOD, make sure that Discord
account has the MOD role **before** signing in — the check runs on every login,
so if you add the role after your first login, just sign out and back in.

---

## 4. Push to Git + deploy on Vercel

```bash
git init
git add .
git commit -m "Initial DeskBuddies Games app"
git remote add origin <your-repo-url>
git push -u origin main
```

(Windows: you'll likely see CRLF/LF conversion warnings on `git add` — these
are cosmetic, not errors.)

In Vercel:

1. **New Project** → import your repo.
2. **Root Directory**: set to `frontend` (this repo has the Supabase project
   alongside the frontend, so Vercel needs to know where the app actually is).
3. **Environment Variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as your local `.env`).
4. Deploy. Once it's live, copy the Vercel URL and add it to Supabase's
   **Authentication → URL Configuration** (Site URL + Redirect URLs), per step
   2.6 above.

**Ordering note for future changes:** whenever a change touches both
`supabase/` and the frontend, deploy the Supabase side first (migration +
every touched Edge Function), *then* `git push`. If the frontend goes live
first, it can call a function or expect a column that isn't deployed yet.

---

## 5. Running your first Trivia Night or Family Feud session

1. Sign in as a MOD → you'll see a **🛠️ MOD Dashboard** button in the header.
2. **Question Sets / Feud Sets → + New set** → name it → add content one at a
   time. Trivia sets support **📋 Import / paste questions** for a whole batch
   at once (there's a "Show example" toggle for the format) — Family Feud's
   set editor doesn't have bulk import yet, so its board + Fast Money
   questions are entered one at a time.
3. Click **▶ Start a session** — this takes you to the host control panel.
4. Tell your members in Discord that a session is starting — they go to the
   matching tile on the dashboard and hit **Join**.
5. In the host panel: **Start Session**, then step through each phase
   (Trivia: Next Question / End question now / grade any pending typed
   answers before moving on. Feud: face-off, board control, steal, then Fast
   Money once the main game ends).
6. **End session** when you're done — everyone sees the final leaderboard/score.

**Only one session — across any game — can be "open" at a time**, enforced
server-side by a shared session lock (not per-game). If starting a session
unexpectedly fails with a "conflict" error and nothing looks active from the
member side, a MOD can use **MOD Dashboard → Troubleshooting → Force-clear
stuck session lock** to clear a lock that got stranded (e.g. by a crash
between "session ended" and "lock released").

A MOD can also join a live session as a **Spectator** — a single-seat,
read-only view of the game (available for Trivia, Feud, UNO, and Impostor
WHO?) that shows exactly what a player would see, useful for a MOD who wants
to watch without playing or without seeing answers before they're revealed.

---

## 6. Running your first UNO game

UNO has no MOD-authored content to set up — there's nothing to "write" ahead
of time, unlike Trivia/Feud/Impostor's content. Starting a game is one click:

1. Sign in as a MOD → **🛠️ MOD Dashboard** → click the **🎴 UNO** tile. This
   creates the session and drops you straight into the host control panel.
2. Tell your members in Discord — they go to the **UNO** tile on the dashboard
   and hit **Join UNO**. 2–10 players.
3. Once everyone's in, reorder with ↑↓ if you want a specific deal order, then
   **▶ Start game**. From here players run the game themselves from their own
   screens — turns, draws, challenges, all of it — there's nothing left to
   click in the host panel except **End game** if you need to cut it short.
4. The game ends itself the instant someone empties their hand — everyone sees
   the final standings automatically.

---

## 7. Running your first Impostor WHO? game

Unlike UNO, Impostor WHO? *does* have MOD-authored content — categories and
their word pools — so there's a one-time setup step per category, same idea
as Trivia's question sets.

1. Sign in as a MOD → **🛠️ MOD Dashboard** → **🕵️ Impostor WHO?** tile → this
   takes you to **Impostor Categories**.
2. **+ New category** → name it (e.g. "Animals") → add words one at a time
   (each word has an optional **clue** field — this is what the Impostor
   sees, so it's worth filling in; if left blank they'll just see the
   category name instead), or click **📋 Import words** to paste a batch
   (supports `Word | Clue` per line, or JSON). You can also import whole
   categories at once from the categories list with **📋 Import
   categories** (a JSON array, or a simple `Category: Name` text template
   — see the in-app example).
3. Open a category and click **▶ Start a session with this category** — this
   creates the session and takes you to the host control panel. (Don't care
   which category? Use **🎲 Start with random category** on the categories
   list instead — the server picks one for you that actually has words.)
4. Tell your members in Discord — they go to the **Impostor WHO?** tile on
   the dashboard and hit **Join game**. Need at least 3 players.
5. Once everyone's in, **▶ Start game**. From here it runs itself: everyone
   gets a card (tap to reveal — crew see the category + secret word, the
   Impostor sees only the category as their one clue), then two rounds of
   typed clues in turn order, then a multiple-choice vote on who they think
   the Impostor is.
   - If the vote doesn't land on the Impostor (a tie, or the wrong person),
     that's treated as "not determined yet" — a fresh 2 rounds start with a
     new random (non-Impostor) player going first, and the group votes again.
   - If it's *still* not determined after that second vote, the Impostor
     wins by default, per the rules as given.
   - A correct vote ends the game immediately — Crew wins.
6. There's nothing to click in the host panel during play except **End
   game** if you need to cut it short — same "players run it themselves"
   model as UNO.

Same cross-game session lock as every other game applies here too — only one
session across any game can be open at once.

---

## Troubleshooting

- **"Members only" even though you're in the server**: usually a mismatch in
  `DISCORD_GUILD_ID`, or the bot hasn't been added to the server. Check the
  Edge Function logs in Supabase (**Edge Functions → verify-membership → Logs**).
- **Discord login redirects to the wrong place / errors out**: check
  Authentication → URL Configuration has your real deployed URL *with the
  `https://` scheme included*, and that the redirect URL in App B's OAuth2
  settings exactly matches what Supabase shows.
- **Login works in a normal mobile browser but hangs or fails from inside
  Discord's own in-app browser**: confirm you're using the two-app split
  above (App B has no bot attached). A single dual-purpose app is the known
  cause of this exact symptom.
- **MOD Dashboard button doesn't show up**: confirm the `DISCORD_MOD_ROLE_ID` is
  right, and that you signed in *after* getting the role (sign out/in to
  re-check).
- **`npx supabase functions deploy ...` fails with "Entrypoint path does not
  exist"**: you're very likely running the command from the wrong working
  directory. `cd` into the actual project root first.
- **`npx supabase db push` fails with `relation "X" already exists`** on a
  project where migrations were previously pasted into the SQL Editor: see
  the migration-repair note in step 2 above, or `PROJECT_CONTEXT.md` for the
  full command.
- **A question, category, or set won't delete**: this is expected once it
  has real play history — it archives instead of hard-deleting, to protect
  existing leaderboard/game history. Check "Show archived" to find and
  restore it if needed. (Impostor's individual *words* are the one exception
  — they always delete outright, since nothing else references them; only
  *categories* archive.)
- **`git push` rejected with "fetch first"** after working from more than one
  machine: the safest fix is a fresh `git clone` into a clean folder rather
  than trying to reconcile histories — see `PROJECT_CONTEXT.md`.
