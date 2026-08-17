# DeskBuddies Games

A web app for the **DeskBuddies** Discord server — a home for the games you and your
MODs come up with. Four so far:

- **Trivia Night** — live-hosted, mixing multiple-choice and typed questions.
- **Family Feud** — live-hosted, face-off / board / steal / Fast Money, fully
  remote (everyone on their own device).
- **UNO** — live-hosted, full ruleset including draw-stacking, jump-in, the
  7-0 house rule, and the Wild Draw Four challenge. 2–10 players.
- **Impostor WHO?** — everyone gets a secret word and its category except
  one random Impostor, who only sees the category as their one clue. Two
  rounds of typed clues, then a multiple-choice vote on who's faking it.

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
- **Live play**: Supabase Realtime (broadcast channels) pushes state updates —
  questions, timers, reveals, leaderboards, turns, card plays — to everyone in
  a session.
- **Anti-cheat by design**: nothing secret ever reaches a browser that isn't
  supposed to see it, and it's always enforced server-side, inside an Edge
  Function using the service-role key, not trusted from the client:
  - Trivia: the correct answer / accepted answers for a question are never
    sent before the host reveals them.
  - Family Feud: same idea for the board, one level deeper for Fast Money —
    a strict "read your own row only" RLS policy means Player 2's client
    can never see Player 1's answers before their sequestered turn.
  - UNO: nobody's hand is readable by anyone but them (RLS "read own row
    only," same pattern as Fast Money), and the draw pile order isn't
    readable by anyone at all — it lives in a table with RLS enabled and
    zero client-facing policies, the same "defense in depth" pattern used
    for the cross-game session lock.
  - Impostor WHO?: three separate secrets, three separate anti-cheat
    boundaries. WHO the Impostor is and WHAT the secret word is live in a
    table with zero client-facing policies (same "defense in depth" idea as
    UNO's draw pile) until the reveal deliberately exposes them at game
    end. Each player's own card (their word, or the Impostor's
    category-only clue) is "read own row only," same as UNO's hands. And
    votes are "read own row only" too, so nobody can watch the tally build
    by peeking at other players' rows — only the resolution broadcast
    reveals the aggregate count once voting closes.
- **Question sets**: MODs build Trivia's, Feud's, and Impostor WHO?'s ahead
  of time — one item at a time, or by pasting a whole batch via each game's
  import tool (Trivia and Impostor WHO? support bulk import; Feud's set
  editor doesn't yet). UNO has no equivalent — it's the standard deck, so a
  MOD starts a game directly from the MOD Dashboard with nothing to author
  first.
- **No shared `games` table.** Trivia, Feud, UNO, and Impostor WHO? keep
  fully separate, parallel tables rather than a unified `games`/`sessions`
  schema. What *is* shared is a small `active_session_lock` table that
  enforces "only one live session, across any game, at a time" — every
  game's `create_session` claims it atomically, same pattern as claiming a
  spectator seat. This was an open question after Trivia shipped alone;
  it's been decided, not just deferred — four games in, the actual
  duplication between them still hasn't justified a schema merge, and every
  game so far is the same shape (everyone-plays-together, host-driven, one
  session at a time). Worth revisiting only if that stops being true.

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
actual colors/logo later is a quick edit, not a rewrite. UNO's card faces reuse
the same danger/warning/success tokens for red/yellow/green rather than
importing UNO's stock bright palette, so they stay in key with the cream
background instead of clashing with it.

## Notes on the React Router advisory

`npm audit` flags a high-severity advisory in `react-router` (RSC-mode CSRF
bypass). This app is a plain client-side SPA using `BrowserRouter`/`Routes` — it
never uses React Router's RSC/framework mode — so this specific vulnerability
doesn't apply here. Worth re-checking if the router setup ever changes.
