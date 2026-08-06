# DeskBuddies Games

A web app for the **DeskBuddies** Discord server — a home for the games you and your
MODs come up with. First game: **Trivia Night**, live-hosted, mixing multiple-choice
and typed questions.

Members sign in with Discord and must be a member of the DeskBuddies server. MODs
(auto-detected from a Discord role) get extra controls to write questions and host
live sessions.

👉 **First time setting this up? Start with [`SETUP.md`](./SETUP.md)** — it walks
through the Discord bot, Supabase project, and Vercel deploy step by step.

## How it's built

```
frontend/          React + TypeScript (Vite), deployed on Vercel
supabase/
  migrations/       Postgres schema + Row Level Security policies
  functions/         Edge Functions (Deno) — the only place secrets live
```

- **Auth**: Discord OAuth via Supabase Auth.
- **Membership gating**: right after login, an Edge Function checks (server-side,
  using a Discord bot token) that the user is actually in the DeskBuddies server,
  and whether they hold the MOD role. This can't be faked from the browser.
- **Live play**: Supabase Realtime (broadcast channels) pushes questions, timers,
  reveals, and leaderboard updates to everyone in a session.
- **Anti-cheat by design**: the correct answer / accepted answers for a question
  are never sent to a player's browser before the host reveals them. All answer
  grading happens inside an Edge Function using the service-role key — the
  frontend only ever receives "correct / incorrect / pending review" for that
  player's own answer.
- **Question sets**: MODs build these ahead of time — one question at a time, or
  by pasting a whole batch (JSON or a simple text template) via the import tool.
- **Platform-shaped, not one-off**: routes, auth, and the MOD/member split are
  written so a second game can be added later without redoing the foundations.
  (There isn't a generic "games" database table yet — with one game, that would
  just be indirection. Worth adding once game #2 shows up.)

## Local development

```bash
cd frontend
cp .env.example .env   # fill in your Supabase project URL + anon key
npm install
npm run dev
```

You'll also need the Supabase project migrated and the Edge Functions deployed —
see `SETUP.md`.

## Design

Cozy "game night" palette — warm cream background, terracotta accent, soft sage
for success states. Every color, font, radius, and shadow lives in
`frontend/src/styles/tokens.css` as CSS variables, so swapping in DeskBuddies'
actual colors/logo later is a quick edit, not a rewrite.

## Notes on the React Router advisory

`npm audit` flags a high-severity advisory in `react-router` (RSC-mode CSRF
bypass). This app is a plain client-side SPA using `BrowserRouter`/`Routes` — it
never uses React Router's RSC/framework mode — so this specific vulnerability
doesn't apply here. Worth re-checking if the router setup ever changes.
