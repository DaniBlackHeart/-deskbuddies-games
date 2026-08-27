# PROJECT_CONTEXT.md — ADDENDUM (Type What You See / `rebus`)

> **Read this first:** the copy of `PROJECT_CONTEXT.md` visible in this
> chat's Project Knowledge is a stale snapshot from 2026-08-14 (only covers
> migrations 0001–0010, Trivia + Feud). Your real, current file already has
> UNO, Impostor WHO?, Wheel of Fortune, migrations up through 0020, and the
> Aug 26 Wheel bugfix session — none of that is reproduced here, and this
> addendum should NOT replace your current file. Paste the sections below
> into it (see suggested placement under each heading), then re-upload the
> merged result to Project Knowledge.

---

## → Add to §1 "What this project is" (game list)

- **Type What You See** (internal code name `rebus`) — live-hosted rebus
  puzzles ("SIR USE LEE" → Seriously). Warm-Up + two scored rounds, a
  two-player Sprint, then a solo Final Round. Solo or Team scoring.

## → Add to §6 "Migration history" table

| # | Contents | Confidence |
|---|---|---|
| 0021 | Type What You See (`rebus_sets`, `rebus_puzzles`, `rebus_sprint_puzzles`, `rebus_sessions`, `rebus_teams`, `rebus_participants`, `rebus_answers`, `rebus_sprint_answers`) — realtime publication additions included in the same migration, not a follow-up | confirmed — built this session, full file in Project Knowledge |

## → Add to §10 Commands Reference / Supabase functions deploy list

```bash
npx supabase functions deploy rebus-host
npx supabase functions deploy rebus-play
npx supabase functions deploy get-rebus-state
```

---

## New section — §13: Type What You See (`rebus`)

### Why "rebus" as the internal name
The genre this game uses — decoding word/letter/number arrangements into a
hidden word or phrase — is actually called a **rebus puzzle**. Following
the same convention as `wheel` (Wheel of Fortune) and `feud` (Family Feud),
all tables/functions use `rebus` as the short internal code; every
player-facing string still says "Type What You See."

### Format, as built
- **Rounds 1–3** (Warm-Up / Round 2 / Round 3): a flat, ordered list of
  puzzles per set (`rebus_puzzles`, `round` ∈ `warmup`/`round2`/`round3`).
  Recommended defaults — Warm-Up 200pts/10s, Round 2 400pts/15s, Round 3
  500pts/15s — are editable per-puzzle, not hard-enforced.
- **Round 4 (Sprint)**: MOD picks any two joined participants after Round 3
  ends. Each gets a sequential 30-second window to race through a shared,
  ordered pool (`rebus_sprint_puzzles`) — flat 500pts per correct answer,
  no penalty for wrong/skipped.
- **Final Round (The Big Puzzle)**: whichever Sprint player scored higher
  (MOD breaks ties) gets one puzzle, 1000pts, 30s, tagged `round='final'`
  in the same `rebus_puzzles` table as rounds 1-3 (single flat
  `order_index` sequence across all four `round` values, main-round
  advancement just filters `round != 'final'`).

### Key decisions made this session (confirmed with Dani before building)
1. **Answering is PARALLEL, like Trivia** — not the turn-based/buzz-race
   reading a literal spec interpretation might suggest ("passed to another
   player if wrong" described a shared-screen party game, which doesn't
   fit "everyone plays on their own device"). Everyone types independently
   within the timer; every correct submitter scores.
2. **Solo/Team toggle, like Wheel** — self-selected teams in the lobby.
   Unlike Wheel, there's no turn rotation layered on top since answering
   stays parallel in team mode too; a correct guess credits the member's
   points to their team's total.
3. **Hints descoped for v1.** The original spec's "+300 without a hint /
   +150 after a hint" speed bonus collapsed to a flat `REBUS_SPEED_BONUS =
   300` on every correct answer (in `_shared/utils.ts`), since without a
   hint mechanic every correct answer is definitionally "without a hint."
   Revisit if hints get built later — the bonus tiering hook would live in
   `rebus-play`'s `submit_answer` action.
4. **Round 4 mirrors Fast Money's shape, not its reveal ceremony** — two
   players, sequential turns, anti-cheat isolated via
   `rebus_sprint_answers` (RLS: read own row only, keyed by pool
   **position** rather than a puzzle row id so there's no way to join
   toward a rival's puzzle text). Unlike Fast Money, Sprint grades live,
   one puzzle at a time, immediately telling the active player
   correct/wrong — no after-the-fact reveal ceremony.
5. **The Final Round is the one deliberate anti-cheat exception in the
   whole project.** Every other secret (Trivia's answers, Feud's board and
   Fast Money, UNO's hands and draw pile, Impostor's word and vote tally,
   Wheel's phrase, Rebus's own Sprint pool) stays hidden until a reveal.
   The Final Round puzzle does not — once live, everyone sees it, since
   there's only one entrant and no rival who'd benefit from seeing it
   early. Worth remembering if a future game's design raises the same
   "does this actually need hiding" question.
6. **`join_code` was NOT propagated into `rebus_sessions`.** It's already
   confirmed dead weight on every other session table (§5) — no reason to
   carry it into a new one.
7. **Scoring reuses Trivia's Chill/Hard exactly** (wrong = -50% of points
   in Hard, no-answer = -25%, both 0 in Chill, via the existing
   `resolveWrongPenalty`/`resolveTimeoutPenalty` helpers) — the Sprint
   Round is the one exception, with no mode-based penalty at all (matches
   the original spec's "Wrong: 0" for that round specifically).
8. **`completed` is a persisted column on `rebus_sessions`**, set once in
   `end_session` — unlike Trivia (which re-derives "did we finish" by
   comparing `current_question_index` to the question count on every
   read), Rebus has two different valid endings (with vs. without a Final
   Round puzzle in the set), which made re-deriving that comparison
   correctly in more than one reader (the host page, `get-rebus-state`,
   the ended-session sound cue) error-prone enough to just store it once.

### Feature parity
- Bulk paste-import: **supported**, both for main puzzles (JSON array or a
  `Round:`/`Type:`/`Display:`/`Answer:`/`Points:`/`Time:` text template)
  and for the Sprint pool (simpler `DISPLAY :: ANSWER :: alt1, alt2`
  one-per-line format). Parser lives in
  `frontend/src/utils/rebusPuzzleParser.ts`.
- Spectator mode: supported, same masking rule as every other game (shows
  exactly what a non-playing member would see) — with the Sprint Round
  showing neither player's puzzle content even to a spectating MOD, and
  the Final Round showing full content to everyone including spectators,
  per decision #5 above.
- Archive-not-delete: `rebus_sets`/`rebus_puzzles` follow the same pattern
  as `question_sets`/`questions` (0010), including the
  `order_index`-contiguity renumbering on delete. `rebus_sprint_puzzles`
  does **not** need this — nothing references a specific row by id (only
  by pool position via `rebus_sprint_answers.puzzle_index`), so it always
  hard-deletes cleanly, same reasoning as `impostor_words`/`wheel_phrases`.

### Not yet built / explicitly out of scope for v1
- Hints (see decision #3) — the game plays without them; the bonus-tiering
  scoring hook exists in the spec but isn't wired to anything yet.
- Team mode for the Sprint/Final Round: the two Sprint players and the
  eventual finalist are always picked as *individuals* regardless of
  team-mode team affiliation — their points still roll up into their
  team's total afterward, but there's no "team vs team" framing for Round
  4 itself.
- This game has not yet been played end-to-end/playtested — expect a
  bugfix pass after Dani's first real session, same pattern as every prior
  game's post-delivery cycle (see §7 for the kind of thing that tends to
  surface: realtime publication gaps, acting-client-own-screen refetch
  gaps, timing edge cases around round transitions).
