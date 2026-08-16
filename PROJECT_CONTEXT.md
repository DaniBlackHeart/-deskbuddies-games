# DeskBuddies Games — Project Context

> **Purpose of this file:** Claude has no memory across separate chats, and a
> Project can't see other conversations unless a file is sitting in its
> Project Knowledge. This file is that fix. Keep it uploaded alongside the
> other project files so any new chat starts with real history instead of
> you re-explaining or re-uploading old chat exports every time.
>
> **How to use it:** point a new chat at this file first. When something
> changes — new migration, new feature, new decision — ask Claude to update
> it, download the result, and re-upload it to Project Knowledge. Claude
> can't write back to Project Knowledge on its own.

Last reconciled: 2026-08-16, adding the UNO build (full ruleset: official +
draw-stacking, jump-in, 7-0, Wild Draw Four challenge; 2–10 players) on top
of the 2026-08-14 reconciliation described below.

---

## 1. What this project is

A web app for the **DeskBuddies** Discord server. Members sign in with
Discord and must be a verified member of the server. MODs (auto-detected via
a Discord role) get extra controls. Three games exist now:

- **Trivia Night** — live-hosted, multiple-choice + typed questions.
- **Family Feud** — live-hosted, face-off / board / steal / Fast Money,
  fully remote (everyone on their own device).
- **UNO** — live-hosted, full ruleset (official + draw-stacking, jump-in,
  7-0 house rule, Wild Draw Four challenge), 2–10 players. Unlike the other
  two, UNO has no MOD-authored content — no equivalent of a "set" — so a
  MOD starts a game directly from the MOD Dashboard rather than from a
  set-editor's "Start session" button.

## 2. Stack

React 19 + TypeScript on Vite · `react-router-dom` v7 · Supabase (Postgres +
RLS, Auth, Realtime, Edge Functions) · Vercel · plain CSS (tokens in
`tokens.css`, reusable classes in `global.css`, inline `style={}` for
one-offs) · React Context + local state only, no Redux/Zustand · `oxlint`.

## 3. Repo structure

```
frontend/
  src/
    pages/trivia/, pages/feud/, pages/uno/    game-specific pages
    pages/mod/                       MOD-only pages (question sets, hosting, spectator, dashboard)
    components/                      shared, game-agnostic UI (GameCard, Timer, Leaderboard,
                                      Buzzer, FeudBoard, TeamScoreboard, TypedAnswerBox, UnoCardView, ...)
    lib/                             archiveOrDelete.ts, unoRules.ts (client-side legality hinting,
                                      mirrors the server check — never authoritative), supabaseClient.ts
                                      (invokeFunction helper), sounds.ts
    styles/tokens.css, global.css
supabase/
  migrations/                        numbered SQL files, currently up to 0011
  functions/
    _shared/utils.ts                 shared helpers (see §6) — includes UNO's deck/shuffle/legality helpers
    verify-membership/               Discord membership + MOD role check
    trivia-host/, trivia-answer/, get-current-question/
    feud-host/, feud-play/, get-feud-state/
    uno-host/, uno-play/, get-uno-state/
```

## 4. Auth & security model (don't break this)

- Discord OAuth via Supabase Auth. `verify-membership` (server-side, Discord
  bot token) checks actual server membership + MOD role — unspoofable from
  the browser.
- **Two separate Discord Applications exist on purpose:** the original app
  (has the Bot, used only for the server-side membership/role check) and a
  second, bot-less app used purely for the Discord OAuth *login* flow.
  This split exists because a single app with both a Bot and OAuth login
  caused Discord's mobile app to intercept login as a bot-authorize flow
  instead of completing a normal web OAuth redirect — broke sign-in from
  Discord's in-app browser on both Android and iOS. **Don't consolidate
  these back into one app** without re-testing mobile in-app login.
- OAuth flow type: **PKCE** (Supabase's default). Implicit flow was tried
  as a workaround for the above bug, then reverted once the real cause
  (the dual-purpose app) was found and fixed.
- **Anti-cheat pattern (apply to any new scored game):** correct/accepted
  answers never reach the browser before reveal. Grading happens in an Edge
  Function using the service-role key. The frontend only ever learns
  correct/incorrect/pending for its own answer. Family Feud's Fast Money
  round uses the same idea one level deeper: `feud_fastmoney_answers` RLS
  is restricted to "read own row only" so Player 2's client literally cannot
  see Player 1's answers before or during their sequestered turn. UNO reuses
  that exact "read own row only" pattern for `uno_hands` (nobody sees
  anyone else's cards), plus a second anti-cheat problem the other two games
  don't have: the draw pile *order* can't be readable by anyone, including
  in aggregate, since it's the same secret every future draw depends on.
  Caught mid-build that this can't just be a column on `uno_sessions` with
  no select policy — RLS is row-level, not column-level, so a blanket
  member-read policy on the row (needed for the genuinely public fields:
  status, turn, discard top) would've exposed the pile columns too, no
  matter what the policy's `using` clause said. Fixed by splitting the
  piles into their own `uno_deck_state` table with RLS enabled and zero
  policies at all — same "defense in depth" shape as `active_session_lock`.
  Worth remembering for any future game with a comparable "everyone can see
  *some* of this row, nobody can see the rest of it" shape.
- DB writes to session/answer/question tables happen only via the
  service-role key inside Edge Functions — no insert/update RLS policy
  exists for the `authenticated` role on those tables, by design.
- `is_mod()` / `is_verified_member()` — `security definer` SQL helpers reused
  everywhere instead of duplicating the membership check per policy.
- A known RLS gap was fixed: MODs could originally only read their own
  `profiles` row, which silently broke username lookups for leaderboards/
  rosters. A later migration granted MODs read access to all profiles.

## 5. Decided: no shared `games`/`sessions` schema (for now)

This was the open question flagged in the original project instructions —
it's been talked through and decided, not just deferred by accident. UNO
shipping as a third game without needing to revisit this is a second real
confirmation, not just a restated intention.

**Conclusion:** Trivia, Feud, and UNO keep fully separate, parallel tables
(`trivia_sessions`/`session_participants`/`answers` vs.
`feud_sessions`/`feud_participants`/`feud_rounds`/`feud_fastmoney_answers`
vs. `uno_sessions`/`uno_participants`/`uno_hands`/`uno_deck_state`).
**No merge.** Instead, a small standalone `active_session_lock` table
(migration `0008`) enforces one rule across the whole catalogue: **only one
live session, across any game, at a time.** Each game's `create_session`
claims the lock atomically before creating its session row (same pattern as
the spectator-seat claim); `end_session` releases it; a MOD-only
`force_release_lock` action exists as a break-glass escape hatch, wired to a
"Force-clear stuck session lock" button in `ModDashboardPage.tsx`'s
Troubleshooting section. UNO's `uno-host`/`uno-play` call the exact same
shared lock helpers (`claimSessionLock`/`releaseSessionLock`/
`forceReleaseSessionLock` in `_shared/utils.ts`) — nothing UNO-specific was
needed there.

**Why not the bigger merge:** the actual requirement (one atomic yes/no
check) was much smaller than a full `game_sessions`/`game_participants`
schema unification would have solved. The reasoning that got here:

- All three games currently share host + lifecycle-status + roster —
  genuinely thin overlap, which is what made a shared layer *possible* in
  principle. UNO doesn't even have Trivia/Feud's third piece (MOD-authored
  content) — no `uno_sets` table exists at all, which if anything argues
  further against a forced-common schema across games this differently
  shaped.
- But the real trigger for merging schemas should be **accumulated
  duplication pain**, not "there might be more games later." The specific,
  concrete problem on the table (global session exclusivity) doesn't need it.
- The bigger `game_sessions`/`game_participants` merge is still considered
  worth doing *eventually* — revisit if duplication (see §8) actually starts
  hurting, not preemptively.
- Every game shipped so far is the same shape (everyone-plays-together,
  host-driven, one session at a time) — no solo/async/daily-puzzle games are
  planned. If that ever changes, re-open this decision.

**Loose end:** `join_code` (on both `trivia_sessions` and `feud_sessions`) is
confirmed dead weight — generated, stored, displayed on the host screen, but
never actually read by any join flow (members just query for "any open
session of this game" and hit a single Join button). It's a legitimate
candidate for removal but **has not been removed** — noted, not yet
actioned. `uno_sessions` deliberately does **not** have this column at all —
no reason to copy a known-dead pattern into a new table.

## 6. Migration history (best-reconciled — see caveat)

| # | Contents | Confidence |
|---|---|---|
| 0001 | Initial schema (profiles, question_sets, questions, trivia_sessions, session_participants, answers) | confirmed — full file in Project Knowledge |
| 0002–0005 | Somewhere in this range: enabling Realtime on live-state tables (missing from 0001 — a genuine original gap), the MOD-can-read-all-profiles RLS policy, and the Chill/Hard mode columns (`mode` on `trivia_sessions`, `penalty_points` on `questions`) | order confirmed, exact file numbering not confirmed |
| 0006 | Spectator mode (`trivia_sessions.spectator_id`) | confirmed by name |
| 0007 | Family Feud parallel schema (`feud_sets`, `feud_round_questions`, `feud_fastmoney_questions`, `feud_sessions`, `feud_participants`, `feud_rounds`, `feud_fastmoney_answers`) | confirmed |
| 0008 | `active_session_lock` (cross-game session lock, see §5) | confirmed |
| 0009 | Feud spectator mode (`feud_sessions.spectator_id`) | confirmed |
| 0010 | Archive-not-delete for `question_sets`/`questions` (`archived_at` columns, partial unique index on active rows so `order_index` can be reused after an archive) | confirmed |
| 0011 | UNO schema (`uno_sessions`, `uno_participants`, `uno_hands`, `uno_deck_state`) | confirmed — full file in Project Knowledge |

**Caveat:** only 0001 is present verbatim in Project Knowledge. Everything
else is reconstructed from chat summaries that described *what* a migration
did without always reproducing the SQL or confirming the exact filename. If
you have the real `supabase/migrations/` folder, upload it and I'll replace
this table with the real thing.

## 7. Known bugs fixed (recurring patterns worth remembering)

- **Host control dead-end state** — a live session with no question started
  yet had no actionable button. Fixed by making every host status always
  show a next action (start/cancel from lobby, start-first-question, end-
  question/next/end-session while running).
- **Realtime never enabled** on the live-state tables in the original
  migration — timers/reveals/leaderboard updates silently didn't push.
- **Ambiguous foreign key**: `answers` has two FKs to `profiles` (submitter
  and grader). An unqualified `profiles(username)` join silently picked the
  wrong one / failed silently. Fixed by disambiguating the relationship
  explicitly in the query, plus added error logging so a failure like this
  is never invisible again.
- **Trivia question/set delete silently no-op'ing** — a hard `DELETE` was
  rejected by Postgres FK `RESTRICT` once a question/set had real play
  history, and the frontend discarded the error instead of surfacing it.
  Fixed with an archive-or-delete pattern (try delete, fall back to
  `archived_at` on FK violation `23503`) plus `order_index` renumbering,
  since Trivia's Edge Functions index into the question array positionally
  — a naive fix that only unblocked delete without renumbering would have
  broken live sessions on the affected set.
- **Feud: `npx supabase db push` failing** with `relation "profiles" already
  exists` — migrations 0001–0008 had originally been run by pasting into the
  Supabase SQL Editor, not via CLI, so the CLI's own tracking table never
  recorded them as applied. First real `db push` tried to replay everything
  from scratch. Fixed with `supabase migration repair` (see §9).
- **Feud: "Failed to send a request to the Edge Function"** on join-team —
  a genuine unreachable-function error, previously shown as a generic
  fallback message. Fixed by building a shared `invokeFunction()` helper
  (using `@supabase/supabase-js`'s `FunctionsHttpError`) that surfaces the
  real error, then swapping every call site over to it.
- **Feud: raw status enum leaking into the UI** (e.g. `Status: main_ended`)
  for any non-lobby session status. Fixed with a `STATUS_LABELS` map.
- **Spectator view side effect**: reusing `get-current-question` for the
  spectator page (intentional, to avoid leaking the answer key) had the side
  effect of marking the spectating MOD as a joined participant. Fixed with a
  spectator flag that skips that specific side effect. (UNO's
  `get-uno-state` doesn't have this problem in the first place — it's
  read-only, never upserts a participant row, so a spectating MOD just
  naturally gets `is_playing: false` with no special-casing needed.)
- **UNO: RLS is row-level, not column-level** — caught during design, before
  it shipped, not after. The draw pile/discard pile were originally going to
  be columns on `uno_sessions` with "no select policy" as the protection,
  copying the reasoning `active_session_lock` uses. But `uno_sessions`
  *needs* a blanket member-read policy for its genuinely public columns
  (status, whose turn, discard top) — and RLS policies apply per row, not
  per column, so that same policy would've handed out the full pile
  contents too. Fixed by moving the piles into their own `uno_deck_state`
  table with zero policies at all. Worth remembering for any future table
  that's "mostly public, but with a couple of columns that can never be" —
  that shape needs a table split, not a narrower policy.
- **UNO: race condition in `play_card`/`draw_card`** — caught during design.
  The original draft removed a card from the player's hand (and wrote it)
  *before* the optimistic-concurrency version-guarded update on
  `uno_sessions`. Two players racing a jump-in on the same discard could
  both get past the initial checks, both mutate their own hand, and then
  only one would actually win the guarded session update — leaving the
  loser's hand permanently short a card for a play that never counted.
  Fixed by reordering every action so the version-guarded session update is
  the single commit point: all validation and computation happens first,
  the guarded write happens next, and hand/deck-state side effects only
  happen after confirming that write actually landed. Worth applying to any
  future action that can legitimately race (as opposed to just
  double-fire, which the simpler "check existing row first" pattern used
  elsewhere already handles fine).

## 8. Feature parity + cleanup flagged, not all resolved

- **Bulk paste-import for question sets** — Trivia has it
  (`QuestionSetsPage`'s import/paste with a "Show example" toggle); Feud's
  `FeudSetEditorPage` does not have an equivalent yet. Not applicable to
  UNO — it has no MOD-authored content at all.
- **Spectator mode** — now on all three games (Trivia via 0006, Feud via
  0009, UNO via 0011), same masking rule every time: the spectator sees
  exactly what a player would see, never anything that would let them
  cheat if they later played (for UNO: no hands, same as `get-uno-state`
  returns for anyone not seated).
- Small duplication flagged but not necessarily cleaned up: `randomJoinCode()`
  copy-pasted between `trivia-host`/`feud-host` (UNO doesn't have this
  problem — no `join_code` at all, see §5); a `broadcast()` helper
  duplicated in three places, now four (`uno-play` has its own copy too).
- **Real correctness bug, not just style:** Feud's Fast Money duplicate-
  answer check reimplements text normalization inline instead of importing
  the shared `normalizeAnswer`, missing accent-stripping. Worth fixing.
- `ModDashboardPage`'s subtitle previously only mentioned Trivia Night —
  **fixed** as part of the UNO build; it now mentions all three games.
- **UNO: Wild Draw Four challenge + stacking, combined** — a deliberate
  scope cut, not a bug, but worth knowing before it comes up in
  playtesting. If a second +4 gets stacked on top of the first, a challenge
  only ever checks the *most recent* +4 played (`pending_draw_from_user_id`
  / `pending_draw_prev_color` only ever track one link, the newest one). A
  successful challenge voids the *entire* accumulated pending draw for the
  challenger, not just the most recent link's 4 cards. Fully general
  N-player stacked-challenge resolution would need to track the whole chain
  of who-played-what-when, which felt like a lot of extra state for an edge
  case of an edge case. Revisit only if it actually comes up and feels
  wrong at the table.

## 9. Deferred / declined features

- **Member-hosting** (letting verified non-MOD members run sessions using
  MOD-authored question sets): design work started — the sketch was scoped
  Row Level Security tied to session ownership rather than a blanket role
  grant, since the core risk is that sessions are publicly joinable, so
  member-authored *content* with no moderation would be effectively public.
  **Explicitly paused before any code was applied or deployed** — nothing to
  undo if this comes back up, but also nothing built yet.

## 10. Commands reference

Confirmed from actual real-world runs across multiple machines (a Lenovo
laptop, at least one desktop PC, and a newer laptop), including the mistakes
that came up and how they were fixed — not just the docs' happy path.

### Golden rule

`cd` into the actual project root before running *any* git or supabase
command. The single most common failure across these chats was running a
command from the wrong working directory (e.g. a Windows user's home folder
instead of the cloned repo) — it doesn't error clearly, it just fails in a
confusing way (`Entrypoint path does not exist`, etc).

### Local dev

```bash
cd frontend
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
npm run build
npx tsc -b                 # or: npx tsc --noEmit
npx oxlint
```

### Supabase CLI (Windows note: skip Scoop)

Install as an npm dev dependency instead of a global tool —
`npm install -D supabase`, then run everything through `npx`:

```bash
npx supabase login                              # once per machine
npx supabase link --project-ref <ref>           # once per machine per project

npx supabase db push                            # apply new migrations
npx supabase functions deploy <function-name>   # once per changed/new function
npx supabase migration list                     # sanity-check what's actually applied
```

**`--project-ref` is the short project ID, not a path and not the full URL.**
It's the subdomain of your Supabase project URL — from
`https://fixlkzjyfpcgnieorlaw.supabase.co` the ref is `fixlkzjyfpcgnieorlaw`.
Find it in the dashboard URL, **Project Settings → General → Reference ID**,
or the start of `VITE_SUPABASE_URL`.

### Git — first-time repo setup

```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Git — ongoing

```bash
git add .
git commit -m "..."
git push
```

### New device / new laptop — one-time setup

```bash
npx supabase login                 # CLI auth is per-machine
git config user.name "Your Name"   # otherwise: commit fails with "Author identity unknown"
git config user.email "you@example.com"
git remote -v                      # confirm this clone points at the right GitHub repo
```

### Ordering matters when a change touches both `supabase/` and the frontend

Run the Supabase steps (migration + every touched function) **before**
`git push`/Vercel deploy — if the frontend goes live first and calls a
function or expects a column that isn't deployed yet, you get a live error
for a window of time. E.g., don't push a "Force-clear stuck session lock"
button before `active_session_lock` and the `force_release_lock` action are
actually live.

### Frontend-only change (no `supabase/` folder touched)

Skip the whole `npx supabase` block — just:

```bash
git add .
git commit -m "..."
git push
```

Vercel auto-deploys from the push.

### Migration-tracking mismatch (`relation "X" already exists`)

Happens if migrations were ever pasted directly into the Supabase SQL
Editor instead of run through `supabase db push` — the CLI's tracking table
doesn't know they were applied, so its next real push tries to replay
everything from scratch and collides.

```bash
npx supabase migration repair 0001 0002 0003 0004 0005 0006 0007 0008 --status applied
npx supabase db push   # should now only apply what's genuinely new
```

(List every migration version that was already actually applied to the live
DB, not just the most recent one.)

### Diverged git history across multiple machines (`push rejected: fetch first`)

Safest fix confirmed in practice: don't try to reconcile — do a fresh
`git clone` from GitHub into a clean folder, then manually re-copy over any
uncommitted local-only files before committing.

### Harmless noise — don't panic

- CRLF/LF conversion warnings on `git add -A` on Windows — cosmetic.
- `Success. No rows returned` in the Supabase SQL Editor after running a
  migration — this is the expected success message, not an error.

---

## 11. What's *not* covered by this file

- Anything from a chat that wasn't exported and shared here.
- This file was reconciled against the real `supabase/migrations/` folder
  and the real `frontend/src` tree during the UNO build (Dani uploaded the
  actual repo zip) — the previous caveat about migrations `0002`–`0009`
  only being reconstructed from chat summaries no longer applies; §6's
  table is now backed by the real files, not a guess. If this file is ever
  picked up in a chat that *doesn't* have the repo uploaded, treat §6 and
  §7 as reliable (they're from the real code) but be aware nothing here
  updates itself — if the repo changes without a matching update to this
  file, this file is the one that's stale, not the code.

## 12. Keeping this file alive across chats

1. Upload it to **Project Knowledge**.
2. Point a new chat at it directly if it isn't picked up automatically.
3. After any chat that produces a real decision, migration, feature, or
   command worth remembering, ask Claude to update this file and re-upload
   the result — Claude can't write back to Project Knowledge on its own.
4. Optionally turn on **memory** in Settings for conversational context too —
   separate system from Project Knowledge, covers chat history rather than
   files.
