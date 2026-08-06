# Setup guide

Follow these in order. It looks long, but it's mostly clicking through dashboards
once — after this, launching a Trivia Night is just a couple of clicks in the app.

## 0. What you'll need

- A Discord account with permission to manage the DeskBuddies server (or ask
  whoever has "Manage Server" to do the Discord steps with you).
- Your Supabase account and Vercel account (you said you already have these).
- A GitHub (or other Git host) repo for this project.
- Node.js 18+ installed locally, if you want to run it on your machine before
  deploying.

---

## 1. Create the Discord application + bot

The bot is only used server-side (to check who's in your server and who has the
MOD role) — it never posts messages or needs to run all the time.

1. Go to https://discord.com/developers/applications → **New Application** →
   name it something like "DeskBuddies Games".
2. **OAuth2 → General**: copy the **Client ID** and **Client Secret**. You'll
   paste these into Supabase in step 2.
3. **OAuth2 → General → Redirects**: add this URL (you'll get the exact one from
   Supabase in step 2, but it looks like):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. **Bot** tab → **Add Bot** → copy the **Bot Token** (click "Reset Token" if you
   need to see it again). Keep this secret — treat it like a password.
   - You do **not** need to enable any "Privileged Gateway Intents" — the app
     only calls the REST API with the bot token, it doesn't maintain a live
     gateway connection.
5. **OAuth2 → URL Generator**: check the **bot** scope, leave permissions at 0
   (none needed), copy the generated URL, open it in your browser, and add the
   bot to the **DeskBuddies** server.
6. Turn on **Developer Mode** in Discord (User Settings → Advanced → Developer
   Mode), then:
   - Right-click the DeskBuddies server icon → **Copy Server ID** → this is your
     `DISCORD_GUILD_ID`.
   - Server Settings → Roles → right-click your MOD role → **Copy Role ID** →
     this is your `DISCORD_MOD_ROLE_ID`.

You should now have: **Client ID**, **Client Secret**, **Bot Token**,
**Guild ID**, **MOD Role ID**.

---

## 2. Set up Supabase

1. In your Supabase project: **Authentication → Sign In / Providers → Discord**
   → enable it → paste the Discord **Client ID** and **Client Secret** from
   step 1. Supabase will show you the exact **Redirect URL** to paste back into
   Discord's OAuth2 settings (step 1.3) if you haven't already.
2. **SQL Editor** → paste the contents of `supabase/migrations/0001_init.sql` →
   Run. (Or, if you use the Supabase CLI: `supabase link --project-ref <ref>`
   then `supabase db push`.)
3. Deploy the Edge Functions. With the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy verify-membership
   supabase functions deploy trivia-host
   supabase functions deploy trivia-answer
   supabase functions deploy get-current-question
   ```
4. Set the Edge Function secrets (these are only ever read server-side):
   ```bash
   supabase secrets set DISCORD_GUILD_ID=your-guild-id
   supabase secrets set DISCORD_MOD_ROLE_ID=your-mod-role-id
   supabase secrets set DISCORD_BOT_TOKEN=your-bot-token
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
   Supabase into every Edge Function — you don't set those yourself.)
5. **Project Settings → API**: copy the **Project URL** and **anon public key**
   — you'll need these for the frontend's `.env`.
6. **Authentication → URL Configuration**: once you know your Vercel URL (step
   4), add it to **Site URL** and **Redirect URLs** too, or Discord login will
   only work on localhost.

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

In Vercel:

1. **New Project** → import your repo.
2. **Root Directory**: set to `frontend` (this repo has the Supabase project
   alongside the frontend, so Vercel needs to know where the app actually is).
3. **Environment Variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as your local `.env`).
4. Deploy. Once it's live, copy the Vercel URL and add it to Supabase's
   **Authentication → URL Configuration** (Site URL + Redirect URLs), per step
   2.6 above.

---

## 5. Running your first Trivia Night

1. Sign in as a MOD → you'll see a **🛠️ MOD Dashboard** button in the header.
2. **Question Sets → + New set** → name it → add questions one at a time, or
   click **📋 Import / paste questions** and paste a list (there's a
   "Show example" toggle for the format).
3. Click **▶ Start a session** — this takes you to the host control panel.
4. Tell your members in Discord that Trivia Night is starting — they go to the
   **Trivia Night** tile on the dashboard and hit **Join**.
5. In the host panel: **Start Session**, then **Next Question** to reveal each
   question, **End question now** if you want to cut a timer short, and review
   any typed answers that need a manual grade before moving on.
6. **End session** when you're done — everyone sees the final leaderboard.

Only one session can be "open" at a time from the member side (the Trivia Night
tab shows whatever the most recent non-ended session is) — so start one, run it
to completion (or end it), before starting the next.

---

## Troubleshooting

- **"Members only" even though you're in the server**: usually a mismatch in
  `DISCORD_GUILD_ID`, or the bot hasn't been added to the server. Check the
  Edge Function logs in Supabase (**Edge Functions → verify-membership → Logs**).
- **Discord login redirects to the wrong place / errors out**: check
  Authentication → URL Configuration has your real deployed URL, and that the
  redirect URL in Discord's OAuth2 settings exactly matches what Supabase shows.
- **MOD Dashboard button doesn't show up**: confirm the `DISCORD_MOD_ROLE_ID` is
  right, and that you signed in *after* getting the role (sign out/in to
  re-check).
