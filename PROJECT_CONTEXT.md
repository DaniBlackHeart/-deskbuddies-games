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

Last reconciled: 2026-08-25, adding Wheel of Fortune Team mode (0019) —
3-12 self-picked teams of 2-3, strict per-teammate rotation mirroring
Family Feud's line order — on top of the 2026-08-21 playtest fixes
(§6c-i, §6c-ii, migration `0018`) and the Impostor WHO?/UNO reconciliation
described below.

---

## 1. What this project is

A web app for the **DeskBuddies** Discord server. Members sign in with
Discord and must be a verified member of the server. MODs (auto-detected via
a Discord role) get extra controls. Five games exist now:

- **Trivia Night** — live-hosted, multiple-choice + typed questions.
- **Family Feud** — live-hosted, face-off / board / steal / Fast Money,
  fully remote (everyone on their own device).
- **UNO** — live-hosted, full ruleset (official + draw-stacking, jump-in,
  7-0 house rule, Wild Draw Four challenge), 2–10 players. No MOD-authored
  content — a MOD starts a game directly from the MOD Dashboard.
- **Impostor WHO?** — live-hosted social deduction. Everyone gets a card
  with the secret word + its category; one random player (the Impostor)
  only sees the category as their bluffing clue. Turn-based typed clues
  (2 rounds), then a multiple-choice accusation vote; repeats once with a
  fresh random starter if inconclusive, Impostor wins by default if it's
  still inconclusive after that. Has MOD-authored content (categories +
  word pools, like Trivia's question sets) — a MOD opens a category and
  starts the session from there, same pattern as Trivia/Feud, not UNO's
  "start directly from the dashboard."
- **Wheel of Fortune** — live-hosted, 2–10 players. Turn-holder is decided
  by a buzzer race (same primitive as Feud's face-off buzz-lock), not seat
  rotation: whoever buzzes in spins, calls a consonant, and keeps going
  while they keep guessing correctly; a miss (or Bankrupt/Lose a Turn)
  locks them out until anyone else lands a correct guess, and if everyone
  eligible is locked out at once the round auto-reveals. 5 main rounds,
  then a Do-or-Die tiebreaker round if tied, then the leader plays a Bonus
  Round (3 category choices, RSTLNE + 3 more consonants + 1 vowel, 20s to
  solve). Has MOD-authored content — categories + phrases, same
  categories/words shape as Impostor WHO? rather than Feud's Sets (see the
  design-decision note in §5).

## 2. Stack

React 19 + TypeScript on Vite · `react-router-dom` v7 · Supabase (Postgres +
RLS, Auth, Realtime, Edge Functions) · Vercel · plain CSS (tokens in
`tokens.css`, reusable classes in `global.css`, inline `style={}` for
one-offs) · React Context + local state only, no Redux/Zustand · `oxlint`.

## 3. Repo structure

```
frontend/
  src/
    pages/trivia/, pages/feud/, pages/uno/, pages/impostor/, pages/wheel/    game-specific pages
    pages/mod/                       MOD-only pages (question sets, hosting, spectator, dashboard)
    components/                      shared, game-agnostic UI (GameCard, Timer, Leaderboard,
                                      Buzzer, FeudBoard, TeamScoreboard, TypedAnswerBox, UnoCardView,
                                      ImpostorCardView, ImpostorClueBoard, WheelBoard, WheelSpinner,
                                      WheelScoreboard, ...)
    lib/                             archiveOrDelete.ts, unoRules.ts (client-side legality hinting,
                                      mirrors the server check — never authoritative), supabaseClient.ts
                                      (invokeFunction helper), sounds.ts, wheelConstants.ts (frontend-side
                                      copies of Wheel's letter sets/costs — _shared/utils.ts is Deno-only
                                      and isn't part of the Vite bundle, so these are deliberately
                                      duplicated, same spirit as randomJoinCode/broadcast below)
    utils/                           questionParser.ts, impostorParser.ts (both: JSON-or-text-template
                                      paste parsers, feeding each game's import modal)
    styles/tokens.css, global.css
supabase/
  migrations/                        numbered SQL files, currently up to 0019
  functions/
    _shared/utils.ts                 shared helpers (see §6) — includes UNO's deck/shuffle/legality
                                      helpers, reused as-is by Impostor for seat rotation (nextUnoSeat
                                      is plain modular arithmetic, nothing UNO-specific about it), plus
                                      Wheel of Fortune's wedge table, phrase-masking, and category/phrase
                                      randomizer helpers
    verify-membership/               Discord membership + MOD role check
    trivia-host/, trivia-answer/, get-current-question/
    feud-host/, feud-play/, get-feud-state/
    uno-host/, uno-play/, get-uno-state/
    impostor-host/, impostor-play/, get-impostor-state/
    wheel-host/, wheel-play/, get-wheel-state/
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
  *some* of this row, nobody can see the rest of it" shape. Impostor WHO?
  hit the exact same shape a third time (see below) and reused the identical
  fix without needing to rediscover it.
- **Impostor WHO? has three separate secrets, not one** — worth being
  deliberate about since it's easy to only catch the obvious one. (1) WHO
  the Impostor is, and (2) WHAT the secret word is, both live in
  `impostor_secrets` — zero client-facing policies, same "defense in depth"
  shape as `uno_deck_state`/`active_session_lock`, only ever touched by the
  service role, and only ever exposed once the game legitimately ends (via
  `impostor_sessions.revealed_impostor_user_id`/`revealed_secret_word`,
  which stay null until then — safe to put on the normally-member-readable
  session row for the same reason `uno_sessions.winner_id` is). (3) WHO
  VOTED FOR WHOM is a *third*, easy-to-miss secret: `impostor_votes` is
  "read own row only" (mirrors `feud_fastmoney_answers`), specifically so
  nobody can watch the accusation tally build in real time by querying
  other players' vote rows — only the server-computed aggregate, broadcast
  once voting closes, reveals counts.
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
shipping as a third game without needing to revisit this was a second real
confirmation; Impostor WHO? shipping as a fourth — with yet another
different shape again (it has MOD content like Trivia/Feud, but a
completely different session state machine with no equivalent in either) —
is a third.

**Conclusion:** Trivia, Feud, UNO, and Impostor WHO? keep fully separate,
parallel tables (`trivia_sessions`/`session_participants`/`answers` vs.
`feud_sessions`/`feud_participants`/`feud_rounds`/`feud_fastmoney_answers`
vs. `uno_sessions`/`uno_participants`/`uno_hands`/`uno_deck_state` vs.
`impostor_sessions`/`impostor_participants`/`impostor_cards`/
`impostor_secrets`/`impostor_clues`/`impostor_votes`).
**No merge.** Instead, a small standalone `active_session_lock` table
(migration `0008`) enforces one rule across the whole catalogue: **only one
live session, across any game, at a time.** Each game's `create_session`
claims the lock atomically before creating its session row (same pattern as
the spectator-seat claim); `end_session` releases it; a MOD-only
`force_release_lock` action exists as a break-glass escape hatch, wired to a
"Force-clear stuck session lock" button in `ModDashboardPage.tsx`'s
Troubleshooting section. UNO's and Impostor's host/play functions all call
the exact same shared lock helpers (`claimSessionLock`/`releaseSessionLock`/
`forceReleaseSessionLock` in `_shared/utils.ts`) — nothing game-specific was
needed there, twice in a row now.

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
| 0012 | Impostor WHO? schema (`impostor_categories`, `impostor_words`, `impostor_sessions`, `impostor_secrets`, `impostor_cards`, `impostor_participants`, `impostor_clues`, `impostor_votes`) | confirmed — full file in Project Knowledge |
| 0013 | Impostor WHO? per-word clues (`impostor_words.clue`, `impostor_cards.clue`) — correction, see §6a-i | confirmed — full file in Project Knowledge |
| 0014 | Impostor WHO? persisted vote tally (`impostor_sessions.final_vote_tally`) — powers the percentage-vote reveal, see §6a-ii | confirmed — full file in Project Knowledge |
| 0015 | Family Feud real face-off rebuttal (`feud_rounds.face_off_provisional_*`) — a correct-but-not-top-answer match now gives the other rep a shot to beat it, instead of any match deciding control immediately | confirmed — full file in Project Knowledge |
| 0016 | Family Feud tiebreaker round (`feud_round_questions.is_tiebreaker`, `feud_sessions.status` gains `'tiebreaker'`) — MOD-flagged tiebreaker-only content, pulled in only if the main game ends tied, replayed through the same face-off/board/steal mechanics as any other round | confirmed — full file in Project Knowledge |
| 0017 | Wheel of Fortune schema (`wheel_categories`, `wheel_phrases`, `wheel_sessions`, `wheel_bonus_secrets`, `wheel_participants`, `wheel_rounds`, `wheel_round_secrets`) — see §6c | confirmed — full file in Project Knowledge |
| 0018 | Wheel of Fortune round rotation fix (`wheel_rounds.is_opened`) — see §6c-ii | confirmed — full file in Project Knowledge |
| 0019 | Wheel of Fortune Team mode (`wheel_sessions.game_mode`/`winner_team_id`/`tiebreak_eligible_team_ids`, `wheel_teams`, `wheel_participants.team_id`/`line_position`, `wheel_rounds.active_team_id`/`locked_out_team_ids`) — see §6c-iii | confirmed — full file in Project Knowledge |

**Caveat:** only 0001 is present verbatim in Project Knowledge. Everything
else is reconstructed from chat summaries that described *what* a migration
did without always reproducing the SQL or confirming the exact filename. If
you have the real `supabase/migrations/` folder, upload it and I'll replace
this table with the real thing.

## 6a. Impostor WHO? — game-design decisions (read this before "fixing" the win condition)

The build request specified the overall shape (2 rounds of clues, vote,
repeat once if inconclusive, Impostor wins by default if still
inconclusive) but left a few mechanics genuinely ambiguous. These were
decided during the build rather than asked about, and are centralized in
one place (`resolveVote` in `impostor-play/index.ts`) specifically so
they're easy to revisit if they're not what was actually wanted:

- **Vote resolution is plurality, not majority.** Whoever gets the single
  most votes is "accused" — they don't need more than half. A tie at the
  top means no accusation was reached.
- **A *wrong* plurality accusation after the first vote is NOT an instant
  Impostor win.** It's treated exactly like a tie/no-consensus: the group
  didn't determine the Impostor, so round-set 2 starts. Only running out of
  rounds (an inconclusive or wrong *second* vote) hands the win to the
  Impostor. This was the most consequential interpretive call in the whole
  build — the spec's literal wording ("if unable to determine... more
  rounds... if still can't, Impostor wins") never actually describes what
  happens on a *wrong but confident* guess, only on failing to reach one.
  If the intent was actually "a wrong guess costs the game immediately, no
  second chance," that's a small, contained change to `resolveVote`.
- **No self-voting.** Server-enforced, not just hidden in the UI.
- **Turn order:** seats are shuffled once at `start_game` (same idea as
  UNO's deal order). Each round-SET (not each round) picks one fresh random
  *non-Impostor* starter — round 2 of a set deliberately repeats the SAME
  starter as round 1, rather than continuing the rotation, so the board
  ends up with exactly 2 clues per player before every vote. Round-set 2 (if
  it happens) gets an independently-chosen new starter, per the spec's
  "instead of continuing from the previous one."
- **The Impostor's clue is a per-word clue authored by the MOD, with the
  category name as a fallback.** ~~Originally built as "the clue IS just
  the category name, nothing more" — that was wrong, caught during
  playtesting (2026-08-18) and fixed in migration `0013`.~~ `impostor_words`
  now has a `clue` column (nullable — a MOD can leave it blank), and
  `impostor_cards.clue` stores whichever one actually applies for that
  session's word, resolved once at `start_game`:
  `pickedWord.clue?.trim() || session.category_name`. The category name is
  still shown alongside the clue on the Impostor's card (it's genuinely
  public info — every crew member's card shows it too — so there's no
  reason to hide it), it's just no longer standing in *as* the clue. The
  category-editor UI (`ImpostorCategoryEditorPage`) has an inline-editable
  clue field per word, and both import paths (`impostorParser.ts`'s
  `Word | Clue` line syntax and JSON `{word, clue}` objects) support
  authoring clues in bulk.
- **Card reveal is click-to-flip, starting face-down** — not in the
  original spec, added because "every member gets a card" reads like a
  physical-card metaphor, and starting hidden avoids an accidental
  shoulder-surf reveal before everyone's ready. Same component shape as
  UNO's face-down back.

## 6a-i. Correction log — Impostor's clue field (2026-08-18)

Worth its own note since it changes a decision documented above as if it
were settled. Playtesting showed the Impostor's card displaying only
"Category: X" as their clue — accurate to what was built, but not what was
actually wanted; the spec's "a clue for the secret word" meant a clue about
that specific word, not the category it belongs to. Fixed with:

- `0013_impostor_word_clues.sql` — adds `impostor_words.clue` and
  `impostor_cards.clue`, both nullable (existing words/cards from `0012`
  keep working, they just have no clue until a MOD adds one).
- `impostor-host`'s `start_game` now selects `word, clue` instead of just
  `word`, and resolves the fallback (`clue || category_name`) once, at deal
  time — not computed client-side, so there's no risk of the fallback logic
  drifting between the card display and whatever a MOD sees while editing.
- The category-editor page, the import parser, and the import-preview modal
  all needed matching updates — a clue is a property of a *word*, not the
  category, so "add a word" now has two fields, "import words" has an
  optional `| clue` suffix per line (or a JSON object shape), and existing
  words got an inline-editable clue field added retroactively so a MOD can
  go back and fill in clues for words created before this fix.

If a similar "which specific level does this field actually belong to"
ambiguity comes up in a future game, this is the pattern that worked: add a
nullable column with a graceful fallback rather than requiring a backfill,
so nothing already-deployed breaks.

## 6a-ii. Percentage-vote reveal (2026-08-18)

Added on request: every member can see how many people voted them (or
anyone else) as the Impostor, as a percentage. The underlying data already
existed — `resolveVote` in `impostor-play` was already computing a full
per-suspect tally to decide the outcome, it just wasn't being shown to
anyone. What changed:

- `vote_resolved`'s broadcast payload gained `total_votes`, needed to turn
  raw counts into percentages (`count / total_votes`).
- `impostor_sessions.final_vote_tally` (migration `0014`) persists the
  tally from whichever vote actually ENDED the game — so the percentage
  breakdown survives a refresh, not just showing up for whoever was live
  and connected the instant the reveal broadcast fired. An inconclusive
  first vote does NOT get persisted (only the terminal one does) — that
  tally is still shown live to anyone connected in the moment, it just
  isn't kept around once the game moves past it, consistent with how other
  intermediate round state in this schema isn't preserved either.
- New component, `ImpostorVoteResults` — a sorted list of every player with
  a percentage bar, 0% included for anyone nobody suspected (deliberately
  not filtered down to only people who got votes — "how many members voted
  YOU" only means something if the 0%-suspicion case is visible too).
- **A real UX problem this surfaced and how it was solved:** the server
  fires `vote_resolved` immediately followed by either `next_round_set_started`
  or `game_ended`. Hydrating on every broadcast (the original pattern) meant
  the percentage reveal would render for a single frame and then get
  instantly replaced by the next phase's UI — nobody would ever actually see
  it. Fixed by NOT hydrating on `next_round_set_started` at all (a sound cue
  still plays), and delaying the hydrate that follows `vote_resolved` by
  `RESULTS_REVEAL_MS` (6s) specifically for the "continue" outcome, so the
  reveal has time to actually be read before round-set 2's UI takes over.
  Terminal outcomes (`crew_win`/`impostor_win`) skip the delay and hydrate
  immediately, because the ended screen shows the same results panel
  permanently rather than on a timer — there's no "replaced too fast"
  problem there. Applied identically in `ImpostorPlayPage` and
  `ImpostorSpectatorPage`; `HostImpostorSessionPage` gets the persisted
  version only (`session.final_vote_tally` on the ended screen) since it
  doesn't listen to the broadcast channel at all, just `postgres_changes`.

## 6b. A real bug caught during review, worth knowing about

`create_session`'s `random_category` option originally joined
`impostor_categories` to `impostor_words` with `!inner(id)` to find
categories that have at least one active word. That's wrong: an inner join
returns one row *per matching word*, so a category with 5 words would
appear 5 times in the result set, silently skewing "random" category
selection toward whichever category happens to have the most words instead
of picking uniformly. Fixed by checking each category's word count
separately (an N+1 query, but N is a handful of MOD-authored categories on
a rarely-called action, so clarity won over the extra round trips — same
trade-off `archiveOrDelete.ts`'s renumbering loop already makes elsewhere
in this codebase). Caught during self-review before shipping, not by Dani —
flagging in case a similar `!inner`-for-existence-check pattern shows up
again in a future game.



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

## 6c. Wheel of Fortune — game-design decisions (read this before "fixing" anything below)

The build request specified the overall shape in real detail (buzz-call
consonants, spin/buy-vowel/solve, the wedge list, 5 rounds, a tiebreaker,
a Bonus Round) but a few mechanics were genuinely ambiguous or under-
specified. These were resolved during the build, not asked about up front,
so they're worth knowing about before "fixing" something that was actually
a deliberate call:

- **Categories, not a hand-curated "Sets" table.** The brief said both
  "phrases in a set like Feud" and "categories with a randomizer like
  Impostor." Rather than building both a Feud-style Sets grouping *and*
  an Impostor-style categories/randomizer (redundant), `wheel_categories`/
  `wheel_phrases` mirrors Impostor's shape exactly, and every round (plus
  the Bonus Round's 3 choices) randomly picks a category + phrase,
  preferring ones not already used that session (`pickWheelCategoryAndPhrase`
  in `_shared/utils.ts`). Trade-off: a MOD can't guarantee a themed game
  (e.g. "all Disney phrases tonight") the way a Feud Set would let them —
  worth adding a real Sets table later if that turns out to matter more
  than the simplicity of one content shape.
- **Turn model is a buzzer race, not seat rotation** — the one genuinely
  new primitive in this game vs. UNO's/Feud's rotation. Whoever wins the
  buzz (plain floor-claim, no letter attached) becomes `active_user_id`
  and immediately owes one mandatory, unscored consonant call — "the
  guessing phase" — before anything else is available to them. Once that
  first call comes back correct, they keep their turn while they keep
  guessing correctly — spinning (now available), calling a consonant,
  buying a vowel, or attempting to solve, in any order, per "at any point
  during their turn a member can attempt to solve." A miss at any point
  (wrong consonant, wrong solve, Bankrupt, or Lose a Turn) adds them to
  `locked_out_user_ids` and reopens the buzzer to everyone else; ANY
  correct consonant guess (even by the same still-active player) clears
  the whole lockout list — that's the literal reading of "locked out until
  another member guessed a correct consonant." If a miss would lock out
  every remaining eligible player, the round auto-reveals instead of
  reopening a buzzer nobody could answer (`resolveTurnEnd` in
  `wheel-play`). This exact sequencing (plain buzz → separate mandatory
  guess → *then* spinning unlocks) took two playtest rounds to land on —
  see the correction log right below before changing any of it again.
- **Vowel cost (350 pts) comes out of the current round's stake**, not a
  cross-round persistent bank — a player needs 350+ points already built
  up *this round* before they can buy. Buying never ends a turn (hit or
  miss), matching the real show. Worth revisiting if playtesting shows
  players stuck unable to ever buy a vowel early in a round.

## 6c-i. Correction log — buzz-then-spin order was backwards (2026-08-21)

First delivery had the buzz claim the floor and go straight to offering
Spin/Buy Vowel/Solve — i.e., spin-before-guess for every single letter,
every time. That directly contradicted the brief's own words: "Every
member will press the buzzer to guess a consonant for the phrase. If the
members guessed the correct consonant, they can spin the wheel to
continue solving the puzzle." Caught via playtesting (screenshots showing
"Spin the wheel" appearing immediately after buzzing, with no consonant
ever having been named).

**This went through two attempts before landing right — worth knowing
which one is actually live:**

- *First attempt* (superseded): made buzzing itself carry a letter —
  pressing a specific consonant key both claimed the floor and submitted
  that guess in one atomic action, graded immediately. This technically
  matched "press the buzzer to guess a consonant" but turned out not to be
  what was wanted: it forced committing to a letter blind, in the same
  instant as racing for the floor, with no separate moment to actually
  think about which consonant to call.
- **Actual fix (live)**: buzzing is a plain floor-claim with no letter
  attached — same generic `Buzzer` component as before, `buzz` action
  takes no arguments. Winning it drops the player straight into
  `awaiting_consonant` with `pending_wedge` left `null` (no spin has
  happened, so this call scores no points) — a genuinely separate step
  where they now pick which consonant to guess. `call_consonant` handles
  both this unscored first call *and* every scored post-spin call from the
  same code path, distinguished only by whether `pending_wedge` is null;
  no new turn-phase value was needed. Hit → clears lockouts, ends "the
  guessing phase," and opens the normal action menu (spin becomes
  *available*, not forced — they can also buy a vowel or solve instead,
  per "at any point during their turn"). Miss → `resolveTurnEnd`, same as
  any other wrong guess, turn moves to the next member.

Everything from the second letter of a turn onward was correct in both
attempts and is still unchanged — once a player holds the floor, "spin,
then call a consonant" (the brief's other sentence: "The contestant can
call one consonant after spinning") is exactly what `awaiting_action` →
`spin` → `awaiting_consonant` → `call_consonant` already did and still
does, wedges (Bankrupt/Lose a Turn/Free Play/Wild Card/Mystery) included.
Both rounds of the bug were scoped entirely to how a turn *starts*.

Two more real bugs caught in the same round of testing:

- **The buzz-phase timer never actually did anything on expiry.** The
  `Timer` component was rendered during `buzz_open` with no `onExpire`
  prop at all, so nothing ever called the (already-existing, already-
  correct) `buzz_timeout` action when the countdown hit zero — the round
  would just sit there forever with a buzzer nobody could press yet
  nothing happening. Fixed by wiring `onExpire={() => callPlay("buzz_timeout")}`.
- **The wheel graphic was small and blank.** `WheelSpinner` was a plain
  `conic-gradient` div with no labels at all — you couldn't tell what
  you'd landed on without waiting for the text below it. Rebuilt as an
  actual labeled SVG (24 wedges, real point values, color-coded specials)
  at nearly double the size, with the same real wedge table
  (`WHEEL_WEDGE_LAYOUT` in `wheelConstants.ts`) the server actually spins
  against — so what's printed on it is honest, even though which wedge it
  visually stops on is still decorative (see the file's own comment for
  why that's fine).
- **Special wedges**, since the brief described what each does but not the
  exact mechanics:
  - **Wild Card** = "allows an additional consonant to be called" is
    implemented as literally 2 consonant calls off one spin
    (`pending_wedge.calls_remaining`), each graded independently; whether
    the turn continues after is decided by the *second* call's outcome,
    same rule as any normal turn.
  - **Free Play** = protects the very next consonant miss from ending the
    turn (`free_play_active`), one-time use, then clears.
  - **Mystery** = an immediate take-500-safe vs. risk-it choice
    (`mystery_choice`); risking is a 50/50 between a 3000-point call and
    an instant Bankrupt-equivalent (turn ends, round points zeroed), no
    consonant call happens on a risk failure.
  - **Bankrupt**/**Lose a Turn** both route through the same
    `resolveTurnEnd` a wrong guess uses — landing on either is treated as
    equivalent to a miss for lockout purposes, since nothing in the brief
    said otherwise and it keeps one player from monopolizing buzzes purely
    off bad wheel luck.
- **Bonus Round prize is a hidden, randomized amount** (5,000–25,000,
  picked when the winner chooses their category, revealed only on
  solve/fail) rather than a fixed number — matches "if they fail, the
  bonus prize is lost" reading as a specific envelope-style prize, not
  just "some points."
- **Do-or-Die tiebreaker eligibility is enforced twice** — server-side via
  `tiebreak_eligible_user_ids` (a non-tied player's `buzz` call gets a 403
  even if they try), and client-side via `round.eligible_user_ids` from
  `get-wheel-state` so an ineligible player doesn't even see a live buzzer
  to tap. Caught the client-side gap myself during review before shipping
  — the server-side check alone was correct but would've shown a
  confusing "buzz then get an error" experience to spectating players.
  Capped at 5 automatic re-tiebreak attempts (`WHEEL_MAX_TIEBREAKER_ATTEMPTS`)
  before falling back to a random pick among the tied players, so a
  content-starved category pool can't loop forever without ever producing
  a Bonus Round winner.
- **Round-to-round pacing is MOD-driven** (`advance_round`), same as
  Trivia's "Next Question" and Feud's per-phase buttons, not automatic —
  a `force_end_round` escape hatch also exists for a stalled/AFK round,
  same "always show a next action" lesson as the host-control dead-end bug
  under §6b/known-bugs above.

## 6c-ii. Correction log — the buzzer was reopening on every miss, not just before the round "opens" (2026-08-21)

Third round of Wheel of Fortune playtesting fixes, same day as 6c-i.
Caught via a screenshot showing the buzzer still live in Round 3 with
letters already on the board, plus a direct description of the wanted
behavior: "the buzzer should [not] be there anymore when there are
already letters on the board... once they spin the wheel and guessed
wrong, the next member can spin next, they don't need to buzz again."

What was live at the time reopened `buzz_open` on *every single miss* for
the whole round — post-spin consonant misses, Bankrupt, Lose a Turn, wrong
solves, timeouts, all of it — forever, for the round's entire duration.
That's not how the real show (or this brief) works: the buzzer is a
one-time face-off to decide who opens the round. Once *any* guess lands
correctly, the buzzer is done — from then on, a miss just passes control
to the next seat directly (they spin immediately, no buzzing), same as
real Wheel of Fortune's seat rotation.

Fix: added `wheel_rounds.is_opened` (migration `0018`, defaults `false` on
every new round). It flips to `true` — permanently, for that round only —
the first time any consonant guess lands correctly, whether that's the
mandatory unscored opening guess (see 6c-i) or a later post-spin one.
`resolveTurnEnd` now branches on it:
- **Not opened**: unchanged from 6c-i — add the misser to
  `locked_out_user_ids`, reopen the buzzer for whoever's left eligible, or
  reveal the phrase if that would lock out everyone.
- **Opened**: no more lockouts, no more buzzing. Control passes straight
  to the next eligible seat (`getNextEligibleUserId`, ordered by
  `wheel_participants.seat_order`, wrapping around — and for a Do-or-Die
  tiebreaker round, filtered to only the tied players, same as the buzz
  phase already was), who lands directly in `awaiting_action` — ready to
  spin, no guess-first step required this time. `locked_out_user_ids` gets
  cleared and stops mattering entirely once a round is opened.

Net effect: the "if all members guessed wrong, the round ends
automatically" auto-reveal rule now correctly applies *only* to the
opening face-off (nobody in the whole room can even get the round
started) — once opened, a round just keeps rotating through seats,
exactly like a real game, until someone actually solves it. No frontend
type changes were needed for the buzzer-hiding part — `turn_phase` never
returns to `'buzz_open'` after opening, so the existing
`turn_phase === 'buzz_open'` check that shows the `Buzzer` component
already stops rendering it automatically. A new `turn_passed` broadcast
event was added (distinct from the pre-opening `turn_ended`) so the
frontend can show "so-and-so's turn to spin!" instead of implying the
buzzer reopened.

**Same-day follow-up:** the `awaiting_action` decision ("Spin the wheel /
Buy a vowel / Solve the puzzle") no longer carries a countdown at all —
requested after playtesting showed a timer pressuring that choice, which
wasn't wanted. Every transition into `awaiting_action` now sets
`turn_deadline: null` instead of `now + WHEEL_ACTION_WINDOW_MS`; no
frontend change was needed since the `Timer` there was already gated on
`turn_deadline_ms` being non-null. Calling a consonant (after spinning),
Mystery's choice, and solving still have their normal 10s/15s timers —
this is scoped specifically to "what do you want to do next," not to
anything with an actual clock-ticking answer already in motion.

**Same-day follow-up, take two:** the wheel graphic itself had two real
bugs, not just cosmetic nitpicks. First, the label rotation math was
inverted — it aligned text with the wedge's *tangent* instead of its
*radius*, so labels at the top/bottom of the wheel rendered near-
horizontal (should be vertical, reading outward along the spoke) and
labels at the sides rendered vertical (should be horizontal). Fixed by
rotating `midAngle - 90` (SVG's unrotated text points along this
component's "90°" position, so that's the offset needed to redirect it
along the wedge's own radius) instead of `midAngle` directly, with the
same "flip 180° if it'd render upside-down" logic as before. Second, the
6 special wedges (Bankrupt/Lose a Turn ×2/Free Play/Wild Card/Mystery) in
`WHEEL_WEDGES` were genuinely clustered — 4 of them sat within an 8-slot
span while the rest of the wheel had none. Reordered (in both
`_shared/utils.ts` and its frontend mirror, `wheelConstants.ts` — order
doesn't affect actual odds, `spinWheel` picks uniformly, so this was
purely a layout fix) so all 6 sit exactly every 4th slot, 60° apart, each
with a mirror-opposite special directly across the wheel. Point-value
frequencies were preserved as closely as reasonable (18 point wedges,
300-900, same rough spread as before) — only the arrangement changed.

**Same-day follow-up, take three — a real bug, not a missing button:**
reported as "Wheel of Fortune doesn't have an end game session button like
the other games once the game is finished." The actual cause: `wheel-play`
never called `releaseSessionLock` anywhere. Every other game's `-play`
function does this on its natural (non-MOD-triggered) win condition —
`impostor-play` on both `vote_resolved` branches, `uno-play` on the
winning play — but Wheel's only ever released the lock from
`wheel-host`'s `end_session` (the MOD's manual cancel). Since a Bonus
Round resolving (`bonus_solve`/`bonus_solve_timeout`) is the *only* way a
Wheel session ends on its own, this meant `active_session_lock` stayed
stranded on every completed game — the game genuinely looked over
(`status: 'ended'`, results screen and all), but no new session (Wheel or
any other game, since the lock is cross-game) could start until a MOD
found their way to "Force-clear stuck session lock" in Troubleshooting,
with nothing on the Wheel host screen surfacing that anything was wrong.
Fixed by adding the same `releaseSessionLock` call, in the same place
(right after setting `status: 'ended'`), that every other game already
has. No new UI was added — like Impostor/UNO, ending naturally releases
the lock automatically; there was never meant to be a visible "end
session" button once a game's already over on its own.

## 6c-iii. Wheel of Fortune — Team mode (2026-08-25)

Second mode alongside the original free-for-all ("solo," unchanged and
still the default): 3-12 teams of 2-3 members, self-picked at join time
(not MOD-assigned, unlike Family Feud's fixed two teams). Built against
three explicit answers from Dani before writing any schema:

- **Team count**: minimum 3, maximum 12 — not Feud's fixed 2.
- **Formation**: members create or join teams themselves in the lobby
  (`create_team`/`join_team` in wheel-play), not MOD-assigned.
- **Within a team's turn**: strict rotation through teammates one at a
  time, explicitly "like Family Feud's line order" — confirmed by reading
  feud-play's actual `current_turn_user_id` advancement (it moves to the
  next roster member after *every* guess, hit or miss, not just misses).

**The turn model gained a second layer, not a replacement.** TEAM-level
control works exactly like solo's individual control always did — a
buzz-off opens each round (`wheel_teams`/`locked_out_team_ids`/
`tiebreak_eligible_team_ids` mirror the solo columns 1:1), and a miss
(once opened) passes control to the next team in `seat_order`, wrapping.
The new piece is entirely WITHIN a team's held control:
`wheel_teams.current_rep_index` tracks whose line turn it is, and it
advances after every fully-resolved action that team takes — spin+call,
buying a vowel, or a solve attempt — regardless of whether that action hit
or missed. This is a genuine departure from solo mode's "same player
keeps going while they're hot": in team mode the TEAM keeps control while
hot, but a *different* teammate is handed the wheel each time. It never
resets between rounds, so turns even out across a whole game rather than
always starting from the front of the line.

**Why almost none of the existing per-action authorization checks needed
to change**: `active_user_id` still means exactly what it always meant —
the one specific person allowed to act right now. In team mode that's
simply whichever teammate `current_rep_index` currently points to. Every
`if (round.active_user_id !== user.id)` check in wheel-play is completely
unaffected; only the *scoring* (round_scores/totals key off `team_id`
instead of `user_id` — `scoreKeyFor()`) and the *transition* logic
(`continueControl()` for hits, the team branch of `resolveTurnEnd()` for
misses) needed team-mode branches.

**Judgment calls made while building this, not explicitly specified:**

- **Buzzing is per-representative, not per-team-member-race.** Only the
  team's *current* rep (by `current_rep_index`) may buzz — a teammate
  further back in line can't jump the queue by clicking faster. This
  keeps "who acts" consistently owned by the rotation pointer at every
  stage, including the opening face-off, not just post-opening turns.
- **Wild Card's second call and Mystery's choice-then-call stay with the
  same individual** — these are one combined action-sequence (matching
  how they already worked in solo mode), so rotation to the next teammate
  only happens once the *whole* sequence resolves, not mid-sequence.
- **The Bonus Round is played by one individual**, not the whole team
  collaboratively — specifically the winning team's current representative
  at the moment the main game ends (or the tiebreaker resolves). Mirrors
  Family Feud's Fast Money being played by individuals rather than the
  team at once. `wheel_sessions.winner_team_id` is new (parallel to the
  existing `winner_user_id`, which still points at the actual individual
  playing) so the team gets credit/history even though one person solves.
- **Team names must be unique per-session** (DB constraint, not just a
  UI nicety) — surfaced as a friendly "a team with that name already
  exists" error on the Postgres `23505` unique-violation code.
- **Known race condition, accepted rather than engineered around**:
  `join_team`'s capacity check (count, then insert) has a TOCTOU gap — two
  people joining the exact same team in the same instant could in theory
  both slip in past the 3-member cap. Same shape of trade-off already
  accepted elsewhere in this codebase for low-likelihood simultaneous
  actions; worth revisiting only if it actually happens in practice.

Schema: migration `0019_wheel_team_mode.sql` — `wheel_sessions.game_mode`
(`'solo' | 'team'`, defaults `'solo'`, so every existing solo game is
unaffected), `wheel_teams` (new table), `wheel_participants.team_id` /
`line_position` (nullable, solo rows stay null), `wheel_rounds.active_team_id`
/ `locked_out_team_ids`. `wheel_sessions.winner_team_id` and
`tiebreak_eligible_team_ids` are separate columns from the solo ones
(never repurposed) so a `uuid[]` of team ids can never be mistaken for one
of user ids.

## 6c-iv. Correction log — the spin animation was getting cut short, and the wheel landed nowhere real (2026-08-26)

Two real bugs from the same playtest report, both about the wheel-spin
moment specifically.

**Bug 1 — Bankrupt/Lose a Turn revealed the next turn before the wheel
stopped spinning.** Those two wedges resolve server-side the instant the
spin lands — `spin`'s handler broadcasts `spin_result` and then
*immediately* (no delay) calls `resolveTurnEnd`, which broadcasts
`turn_ended`/`turn_passed`/`round_ended` right behind it. The frontend's
`spin_result` handler correctly held its own reveal back for the ~2.3s
animation, but `turn_ended`/`turn_passed`/`round_ended` each had their own
separate handler that hydrated *immediately* — so the board would jump to
"so-and-so's turn now" while the wheel graphic was still visibly spinning
for everyone. Every other wedge type (points, Wild Card, Free Play,
Mystery) is naturally safe from this because they all require a distinct
follow-up player action (calling a consonant, making a choice) before
anything else can happen — Bankrupt and Lose a Turn are the only two
outcomes with no human in the loop between the spin and the next state
change.

Fixed with a small deferred-action queue (`postSpinQueue` in both
`WheelPlayPage` and `WheelSpectatorPage`): while a spin's reveal timeout
is pending, `turn_ended`/`turn_passed`/`turn_timed_out`/`round_ended`
queue their work instead of running it, and the queue drains right after
the spin's own timeout fires. Nothing else needed to change — hydrate()
always fetches complete fresh state regardless of which event triggered
it, so deferring is lossless.

**Bug 2 — the wheel didn't actually land on its own announced outcome.**
`WheelSpinner` was explicitly designed to spin to a *decorative* random
angle (see the component's original comment) on the theory that the text
result below it was the real information. Playtesting showed that's not
good enough — a screenshot showed the wheel stopped with the pointer
between wedges, and the text below it and where the arrow physically
landed had nothing to do with each other. Fixed: `WheelSpinner` now takes
a `targetWedge` prop and computes the actual rotation needed to land a
*matching* wedge (same type, same value for point-bearing wedges — chosen
at random among any ties, e.g. one of the four 500-point wedges) precisely
under the fixed pointer, always spinning forward from the current angle
plus a few extra full turns for flourish. `WheelPlayPage`/
`WheelSpectatorPage` now pass the real wedge from the `spin_result`
broadcast in as `targetWedge` the moment a spin starts, so what the arrow
points at and what the game announces are finally the same thing.

## 8. Feature parity + cleanup flagged, not all resolved

- **Bulk paste-import for question sets** — Trivia has it
  (`QuestionSetsPage`'s import/paste with a "Show example" toggle); Impostor
  WHO? has it too (`ImpostorImportModal`, both words-only and whole
  categories-with-words); Feud's `FeudSetEditorPage` and Wheel of
  Fortune's `WheelCategoryEditorPage` are the two now left without it —
  both are one-phrase-at-a-time only. Not applicable to UNO — no
  MOD-authored content at all.
- **Spectator mode** — now on all five games (Trivia via 0006, Feud via
  0009, UNO via 0011, Impostor WHO? via 0012, Wheel of Fortune via 0017),
  same masking rule every time: the spectator sees exactly what a player
  would see, never anything that would let them cheat if they later played
  (Impostor: no card, no vote; Wheel: the same server-masked phrase
  everyone else gets — same `is_playing`/no-special-casing shape as UNO).
- Small duplication flagged but not necessarily cleaned up: `randomJoinCode()`
  copy-pasted between `trivia-host`/`feud-host` (UNO/Impostor don't have this
  problem — no `join_code` at all, see §5); a `broadcast()` helper
  duplicated across `uno-play`/`impostor-host`/`impostor-play` now too.
- **Real correctness bug, not just style:** Feud's Fast Money duplicate-
  answer check reimplements text normalization inline instead of importing
  the shared `normalizeAnswer`, missing accent-stripping. Worth fixing.
- `ModDashboardPage`'s subtitle: fixed during the UNO build to mention all
  three games at the time; fixed again during the Impostor build to
  mention all four; **fixed a third time** during the Wheel of Fortune
  build to mention all five. This is now three-for-three going stale on
  every single new game — worth just grepping for a hardcoded game
  list/count anywhere else in the frontend before the *next* one ships,
  rather than waiting to notice it's wrong again.
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
- **Impostor WHO?: the vote-resolution interpretive calls in §6a** are the
  single highest-risk-of-being-wrong part of this build — flagged there in
  detail rather than repeated here, but worth a second read if Dani reports
  the game "feels off" after playtesting.

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
