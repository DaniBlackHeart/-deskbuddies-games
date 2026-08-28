// Shared helpers used across all Edge Functions.
// Deno runtime (Supabase Edge Functions).

import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/** Admin client using the service role key — bypasses RLS. Server-side only. */
export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Resolves the calling user from the request's Authorization header.
 * Returns null if the token is missing/invalid.
 */
export async function getCallingUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/** Confirms the caller is a verified MOD (checked server-side, never trusted from the client). */
export async function requireMod(req: Request) {
  const user = await getCallingUser(req);
  if (!user) return { error: jsonResponse({ error: "Not authenticated" }, 401) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_mod) {
    return { error: jsonResponse({ error: "MOD access required" }, 403) };
  }
  return { user, profile };
}

/** Confirms the caller is a verified DeskBuddies member. */
export async function requireMember(req: Request) {
  const user = await getCallingUser(req);
  if (!user) return { error: jsonResponse({ error: "Not authenticated" }, 401) };

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_member) {
    return { error: jsonResponse({ error: "Membership required" }, 403) };
  }
  return { user, profile };
}

/** Normalizes text for typed-answer matching: lowercase, trim, collapse whitespace, strip punctuation. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ");
}

/** Deduction for a submitted-but-wrong answer. Defaults to half of points, rounded. */
export function resolveWrongPenalty(question: { points: number; penalty_points: number | null }): number {
  return question.penalty_points ?? Math.round(question.points / 2);
}

/** Flat deduction for not answering at all: 25% of points, rounded. */
export function resolveTimeoutPenalty(question: { points: number }): number {
  return Math.round(question.points * 0.25);
}

export function typedAnswerMatches(submitted: string, accepted: string[]): boolean {
  const normalizedSubmitted = normalizeAnswer(submitted);
  return accepted.some((a) => normalizeAnswer(a) === normalizedSubmitted);
}

// --- Cross-game session exclusivity ---

/**
 * Atomically claims the single global "a session is running" lock, so at
 * most one session — of ANY game — can be live at a time. Call this before
 * creating a new session row; if it returns non-null, stop and return that
 * response instead of creating the session.
 */
export async function claimSessionLock(
  admin: ReturnType<typeof getAdminClient>,
  opts: { game: string; sessionId: string; hostId: string }
): Promise<Response | null> {
  const { error } = await admin
    .from("active_session_lock")
    .insert({ lock_key: true, game: opts.game, session_id: opts.sessionId, host_id: opts.hostId });

  if (!error) return null;

  const { data: existing } = await admin.from("active_session_lock").select("game").maybeSingle();
  return jsonResponse(
    { error: `A ${existing?.game ?? "different"} session is already running. End it before starting a new one.` },
    409
  );
}

/** Releases the global session lock. Safe to call even if it's already gone. */
export async function releaseSessionLock(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  await admin.from("active_session_lock").delete().eq("session_id", sessionId);
}

/**
 * Force-clears the global session lock regardless of who holds it or what
 * session it points to — the "it crashed / somebody forgot to end it"
 * escape hatch, same reasoning as trivia-host's release_spectator (any mod
 * can release it, not just whoever holds it, so it can't get permanently
 * stuck). Returns the cleared row, if any, so the caller can tell the mod
 * what just got released.
 */
export async function forceReleaseSessionLock(admin: ReturnType<typeof getAdminClient>) {
  const { data } = await admin
    .from("active_session_lock")
    .delete()
    .eq("lock_key", true)
    .select()
    .maybeSingle();
  return data as { game: string; session_id: string; host_id: string; started_at: string } | null;
}

// --- Spectator seat (single-claim "who's currently watching") ---

/**
 * Atomically claims a single-seat spectator slot on a session row. Only one
 * user can hold it at a time. The read-then-check below exists only to
 * return a friendlier "taken by X" message in the common case — the actual
 * atomicity comes from the conditional update's .is("spectator_id", null),
 * which loses a genuine race cleanly instead of letting both callers win.
 */
export async function claimSpectatorSeat(
  admin: ReturnType<typeof getAdminClient>,
  opts: { table: string; sessionId: string; userId: string }
): Promise<Response | null> {
  const { data: session } = await admin
    .from(opts.table)
    .select("id, spectator_id")
    .eq("id", opts.sessionId)
    .single();
  if (!session) return jsonResponse({ error: "Session not found" }, 404);

  if (session.spectator_id === opts.userId) {
    return null; // already theirs (e.g. page refresh) — treat as success
  }

  if (session.spectator_id) {
    const { data: holder } = await admin
      .from("profiles")
      .select("username")
      .eq("id", session.spectator_id)
      .maybeSingle();
    return jsonResponse({ error: `Already being watched by ${holder?.username ?? "another mod"}.` }, 409);
  }

  const { data: claimed } = await admin
    .from(opts.table)
    .update({ spectator_id: opts.userId })
    .eq("id", opts.sessionId)
    .is("spectator_id", null)
    .select()
    .maybeSingle();

  if (!claimed) {
    return jsonResponse({ error: "Someone just claimed this seat — try again." }, 409);
  }
  return null;
}

/** Releases a session's spectator seat. Any mod can call this, not just whoever holds it — avoids it getting permanently stuck. */
export async function releaseSpectatorSeat(admin: ReturnType<typeof getAdminClient>, table: string, sessionId: string) {
  await admin.from(table).update({ spectator_id: null }).eq("id", sessionId);
}

// --- Family Feud helpers ---

export type FeudAnswer = { text: string; points: number; alt_answers?: string[] };

/**
 * Checks a submitted guess against a board's ranked answer list and returns
 * the matched index, or null if it's not on the board. Skips indices already
 * in `excludeIndices` (already-revealed or already-guessed slots) — repeating
 * a used answer isn't a valid guess, same as the real show.
 * Matches against both the answer's main text and any `alt_answers` a MOD
 * pre-registered, using the same normalization as trivia's typed matching.
 */
export function matchFeudAnswer(
  submitted: string,
  answers: FeudAnswer[],
  excludeIndices: number[] = []
): number | null {
  const normalizedSubmitted = normalizeAnswer(submitted);
  if (!normalizedSubmitted) return null;
  const excluded = new Set(excludeIndices);

  for (let i = 0; i < answers.length; i++) {
    if (excluded.has(i)) continue;
    const candidates = [answers[i].text, ...(answers[i].alt_answers ?? [])];
    if (candidates.some((c) => normalizeAnswer(c) === normalizedSubmitted)) {
      return i;
    }
  }
  return null;
}

/** Ranks answer indices ascending by points (least valuable first) — used for the facilitator's "lost the face-off" reveal. */
export function feudReveaLeastToMostIndices(answers: FeudAnswer[]): number[] {
  return answers
    .map((_, i) => i)
    .sort((a, b) => answers[a].points - answers[b].points);
}

/** Public-safe board shape: text/points hidden until the index is revealed. */
export function toPublicFeudAnswers(answers: FeudAnswer[], revealedIndices: number[]) {
  const revealed = new Set(revealedIndices);
  return answers.map((a, i) =>
    revealed.has(i) ? { text: a.text, points: a.points, revealed: true } : { revealed: false }
  );
}

/** Builds a Discord CDN avatar URL, falling back to Discord's default embed avatar. */
export function discordAvatarUrl(discordId: string, avatarHash: string | null, discriminator = "0") {
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
  }
  const fallbackIndex = discriminator === "0"
    ? Number((BigInt(discordId) >> 22n) % 6n)
    : Number(discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

// --- UNO helpers ---

export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoCard = {
  color: UnoColor | "wild";
  value: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "wild4";
};

const UNO_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const UNO_ACTION_VALUES = ["skip", "reverse", "draw2"] as const;

/** Builds the standard 108-card UNO deck, unshuffled. */
export function buildUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) as UnoCard["value"] });
      deck.push({ color, value: String(n) as UnoCard["value"] });
    }
    for (const action of UNO_ACTION_VALUES) {
      deck.push({ color, value: action });
      deck.push({ color, value: action });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "wild4" });
  }
  return deck;
}

/** Fisher-Yates. Returns a new array — never mutates the input. */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isUnoActionCard(card: UnoCard): boolean {
  return (UNO_ACTION_VALUES as readonly string[]).includes(card.value);
}
export function isUnoWildCard(card: UnoCard): boolean {
  return card.color === "wild";
}
export function isUnoNumberCard(card: UnoCard): boolean {
  return !isUnoActionCard(card) && !isUnoWildCard(card);
}

/**
 * Legal-play check for a normal turn (not a jump-in — see
 * isUnoJumpInMatch for that). `pendingDrawType` restricts you to
 * matching draw cards only, per the stacking house rule. A non-wild card
 * is legal if it matches the active color OR the discard top's value
 * (e.g. a blue 7 on a red 7), so this needs the actual discard top, not
 * just the active color.
 */
export function isUnoLegalPlayAgainst(
  card: UnoCard,
  discardTop: UnoCard,
  currentColor: UnoColor,
  pendingDrawType: "draw_two" | "draw_four" | null
): boolean {
  if (pendingDrawType === "draw_two") return card.value === "draw2";
  if (pendingDrawType === "draw_four") return card.value === "wild4";
  if (isUnoWildCard(card)) return true;
  return card.color === currentColor || card.value === discardTop.value;
}

/** Jump-in (house rule): legal any time, out of turn, only on an EXACT color+value match. */
export function isUnoJumpInMatch(card: UnoCard, discardTop: UnoCard): boolean {
  return card.color === discardTop.color && card.value === discardTop.value;
}

/**
 * Next seat index in `direction`, wrapping around `totalSeats`. Pass
 * `steps: 2` for a Skip (or a Reverse in a 2-player game, which the
 * official rules treat as a Skip).
 */
export function nextUnoSeat(currentSeat: number, direction: 1 | -1, totalSeats: number, steps = 1): number {
  return (((currentSeat + direction * steps) % totalSeats) + totalSeats) % totalSeats;
}

/**
 * Draws `count` cards from the draw pile, reshuffling the discard pile
 * (minus whatever's passed as the current top, which stays put) back
 * into a fresh draw pile if it runs out mid-draw. Returns the drawn
 * cards plus the piles' new state — caller is responsible for persisting
 * both `draw_pile` and `discard_pile` after calling this.
 */
export function drawUnoCards(
  drawPile: UnoCard[],
  discardPile: UnoCard[],
  count: number
): { drawn: UnoCard[]; newDrawPile: UnoCard[]; newDiscardPile: UnoCard[] } {
  let pile = [...drawPile];
  let discard = [...discardPile];
  const drawn: UnoCard[] = [];

  for (let i = 0; i < count; i++) {
    if (pile.length === 0) {
      if (discard.length === 0) break; // both piles genuinely empty — stop early rather than loop forever
      pile = shuffle(discard);
      discard = [];
    }
    drawn.push(pile.pop()!);
  }

  return { drawn, newDrawPile: pile, newDiscardPile: discard };
}

// --- Wheel of Fortune helpers ---

export const WHEEL_VOWELS = ["A", "E", "I", "O", "U"];
export const WHEEL_CONSONANTS = [
  "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
]; // Y is always a consonant on the wheel, same as the real show.

export type WheelWedge =
  | { type: "points"; value: number }
  | { type: "bankrupt" }
  | { type: "lose_turn" }
  | { type: "free_play"; value: number }
  | { type: "wild_card"; value: number }
  | { type: "mystery" };

/**
 * A 24-wedge wheel: 18 point wedges (300-900) plus Bankrupt x1, Lose a
 * Turn x2, Free Play x1, Wild Card x1, Mystery x1 — the 6 specials sit
 * exactly every 4th slot (60° apart), so each one has a mirror-opposite
 * special directly across the wheel instead of clustering together on
 * one side. Order doesn't affect actual odds (spinWheel picks uniformly
 * at random) — it only matters for how the frontend's wheel graphic lays
 * the wedges out, which mirrors this exact table.
 */
export const WHEEL_WEDGES: WheelWedge[] = [
  { type: "bankrupt" },
  { type: "points", value: 500 },
  { type: "points", value: 600 },
  { type: "points", value: 700 },
  { type: "lose_turn" },
  { type: "points", value: 300 },
  { type: "points", value: 400 },
  { type: "points", value: 500 },
  { type: "free_play", value: 500 },
  { type: "points", value: 600 },
  { type: "points", value: 700 },
  { type: "points", value: 300 },
  { type: "wild_card", value: 500 },
  { type: "points", value: 400 },
  { type: "points", value: 500 },
  { type: "points", value: 600 },
  { type: "mystery" },
  { type: "points", value: 700 },
  { type: "points", value: 300 },
  { type: "points", value: 400 },
  { type: "lose_turn" },
  { type: "points", value: 500 },
  { type: "points", value: 800 },
  { type: "points", value: 900 },
];

export function spinWheel(): { wedge: WheelWedge; index: number } {
  const index = Math.floor(Math.random() * WHEEL_WEDGES.length);
  return { wedge: WHEEL_WEDGES[index], index };
}

export const WHEEL_VOWEL_COST = 350;
export const WHEEL_MYSTERY_FACE_VALUE = 500;
export const WHEEL_MYSTERY_BONUS_VALUE = 3000;
export const WHEEL_MYSTERY_RISK_WIN_CHANCE = 0.5;
export const WHEEL_MIN_PLAYERS = 2;
export const WHEEL_MAX_PLAYERS = 10;
export const WHEEL_MIN_TEAMS = 3;
export const WHEEL_MAX_TEAMS = 12;
export const WHEEL_MIN_TEAM_SIZE = 2;
export const WHEEL_MAX_TEAM_SIZE = 3;
export const WHEEL_MAIN_ROUNDS = 5;
export const WHEEL_BUZZ_WINDOW_MS = 10_000;
export const WHEEL_ACTION_WINDOW_MS = 10_000;
export const WHEEL_SOLVE_WINDOW_MS = 15_000;
export const WHEEL_BONUS_SOLVE_WINDOW_MS = 20_000;
export const WHEEL_BONUS_GIVEN_LETTERS = ["R", "S", "T", "L", "N", "E"];
export const WHEEL_BONUS_PRIZE_POOL = [5000, 7500, 10000, 15000, 25000];
export const WHEEL_MAX_TIEBREAKER_ATTEMPTS = 5;

/** True if the character is a letter A-Z (case-insensitive). */
export function isWheelLetter(ch: string): boolean {
  return /^[A-Za-z]$/.test(ch);
}

/**
 * Builds the public "masked" version of a phrase: any letter that's been
 * guessed is shown as-is (original case preserved), every other letter is
 * a blank placeholder, and non-letter characters (spaces, punctuation)
 * always show through. `guessedLetters` should be uppercase; matching is
 * case-insensitive either way.
 */
export function maskWheelPhrase(phraseText: string, guessedLetters: string[]): string {
  const guessed = new Set(guessedLetters.map((l) => l.toUpperCase()));
  return phraseText
    .split("")
    .map((ch) => (isWheelLetter(ch) ? (guessed.has(ch.toUpperCase()) ? ch : "_") : ch))
    .join("");
}

/** How many times a letter appears in the phrase (letters only, case-insensitive). */
export function countWheelLetterOccurrences(phraseText: string, letter: string): number {
  const upper = letter.toUpperCase();
  let count = 0;
  for (const ch of phraseText.toUpperCase()) {
    if (ch === upper) count++;
  }
  return count;
}

/** True once every letter in the phrase has been guessed — the puzzle is fully revealed. */
export function isWheelPhraseFullyRevealed(phraseText: string, guessedLetters: string[]): boolean {
  const guessed = new Set(guessedLetters.map((l) => l.toUpperCase()));
  for (const ch of phraseText.toUpperCase()) {
    if (isWheelLetter(ch) && !guessed.has(ch)) return false;
  }
  return true;
}

/** Exact-match phrase-solve comparison (case/punctuation/whitespace-insensitive via normalizeAnswer). */
export function wheelPhraseMatches(guess: string, actual: string): boolean {
  return normalizeAnswer(guess) === normalizeAnswer(actual);
}

/**
 * Picks a random category (preferring one not in `excludeCategoryIds`)
 * that has at least one active phrase, then a random active phrase within
 * it (preferring one not in `excludePhraseIds`). Falls back to relaxing
 * the exclusions — category repeat first, then phrase repeat — rather
 * than failing outright, so a MOD with a small content library can still
 * run a full 5-round game. Returns null only if there are truly zero
 * active phrases anywhere.
 */
export async function pickWheelCategoryAndPhrase(
  admin: ReturnType<typeof getAdminClient>,
  excludeCategoryIds: string[],
  excludePhraseIds: string[]
): Promise<{ category: { id: string; name: string }; phrase: { id: string; phrase: string } } | null> {
  const { data: categories } = await admin.from("wheel_categories").select("id, name").is("archived_at", null);
  if (!categories || categories.length === 0) return null;

  const withCounts = await Promise.all(
    categories.map(async (c) => {
      const { count } = await admin
        .from("wheel_phrases")
        .select("id", { count: "exact", head: true })
        .eq("category_id", c.id)
        .is("archived_at", null);
      return { id: c.id, name: c.name, count: count ?? 0 };
    })
  );

  const withPhrases = withCounts.filter((c) => c.count > 0);
  if (withPhrases.length === 0) return null;

  const excludeCatSet = new Set(excludeCategoryIds);
  const unusedCategories = withPhrases.filter((c) => !excludeCatSet.has(c.id));
  const categoryPool = unusedCategories.length > 0 ? unusedCategories : withPhrases;
  const pickedCategory = categoryPool[Math.floor(Math.random() * categoryPool.length)];

  const { data: phrases } = await admin
    .from("wheel_phrases")
    .select("id, phrase")
    .eq("category_id", pickedCategory.id)
    .is("archived_at", null);
  if (!phrases || phrases.length === 0) return null;

  const excludePhraseSet = new Set(excludePhraseIds);
  const unusedPhrases = phrases.filter((p) => !excludePhraseSet.has(p.id));
  const phrasePool = unusedPhrases.length > 0 ? unusedPhrases : phrases;
  const pickedPhrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];

  return {
    category: { id: pickedCategory.id, name: pickedCategory.name },
    phrase: { id: pickedPhrase.id, phrase: pickedPhrase.phrase },
  };
}

/** Picks `count` distinct random categories that each have at least one active phrase — used for the Bonus Round's 3 category choices. */
export async function pickRandomWheelCategories(
  admin: ReturnType<typeof getAdminClient>,
  count: number
): Promise<{ id: string; name: string }[]> {
  const { data: categories } = await admin.from("wheel_categories").select("id, name").is("archived_at", null);
  if (!categories || categories.length === 0) return [];

  const withCounts = await Promise.all(
    categories.map(async (c) => {
      const { count: phraseCount } = await admin
        .from("wheel_phrases")
        .select("id", { count: "exact", head: true })
        .eq("category_id", c.id)
        .is("archived_at", null);
      return { id: c.id, name: c.name, count: phraseCount ?? 0 };
    })
  );

  const eligible = withCounts.filter((c) => c.count > 0);
  return shuffle(eligible).slice(0, count).map((c) => ({ id: c.id, name: c.name }));
}

// --- "Type What You See" (rebus) helpers ---

// Flat bonus added to every correct main/Final Round answer. The original
// spec's "+300 without a hint / +150 after a hint" collapsed to this flat
// value once hints were descoped for v1 (see 0021_rebus_game.sql) — every
// correct answer is, by definition, "without a hint" for now.
export const REBUS_SPEED_BONUS = 300;

// Flat award per correct Sprint (Round 4) answer — no penalty for a wrong
// or skipped one, since the Sprint is a race against the clock, not a
// scored quiz.
export const REBUS_SPRINT_POINTS = 500;

export const REBUS_SPRINT_SECONDS = 30;

// Up to this many puzzles get pulled into each of Rounds 1-3 when a
// session is created — same fixed defaults the original single-set
// format used (10 Warm-Up / 10 Round 2 / 10 Round 3), kept as a shared
// constant now that the pool is assembled programmatically instead of by
// a MOD hand-curating exactly this many puzzles per round. If a round's
// combined pool (across every set) has fewer than this many active
// puzzles, the session just gets however many exist.
export const REBUS_PUZZLES_PER_ROUND = 10;

const REBUS_MAIN_ROUNDS = ["warmup", "round2", "round3"] as const;

/**
 * Builds ONE session's Rounds 1-3 + Final Round puzzle pool by randomly
 * mixing every active (non-archived) puzzle from EVERY rebus_set together
 * — confirmed with Dani (2026-08-29) as the replacement for "start a
 * session from one specific set," mirroring how Wheel of Fortune
 * randomizes its own category + phrase each round instead of a MOD
 * picking one up front. See 0023_rebus_mixed_sessions.sql for why the
 * result gets copied into a session-scoped snapshot table rather than
 * just recording which rebus_puzzles rows were chosen.
 *
 * Returns rows shaped for rebus_session_puzzles (session_id not yet
 * attached — the caller adds it after the session row exists).
 * order_index is one flat counter across warmup -> round2 -> round3,
 * with the Final Round puzzle (if any exist anywhere) appended last —
 * mirrors the single contiguous order_index sequence rebus_puzzles used
 * per set, so next_puzzle/end_puzzle's positional stepping logic needs
 * no changes beyond querying by session_id instead of rebus_set_id.
 */
export async function pickRebusSessionPuzzles(admin: ReturnType<typeof getAdminClient>) {
  const { data: allPuzzles } = await admin.from("rebus_puzzles").select("*").is("archived_at", null);

  type Row = {
    round: string;
    order_index: number;
    source_puzzle_id: string;
    puzzle_type: string;
    display_text: string;
    answer_text: string;
    accepted_answers: unknown;
    points: number;
    time_limit_seconds: number;
  };

  const rows: Row[] = [];
  let cursor = 0;

  for (const round of REBUS_MAIN_ROUNDS) {
    const candidates = (allPuzzles ?? []).filter((p) => p.round === round);
    const picked = shuffle(candidates).slice(0, REBUS_PUZZLES_PER_ROUND);
    for (const p of picked) {
      rows.push({
        round,
        order_index: cursor++,
        source_puzzle_id: p.id,
        puzzle_type: p.puzzle_type,
        display_text: p.display_text,
        answer_text: p.answer_text,
        accepted_answers: p.accepted_answers,
        points: p.points,
        time_limit_seconds: p.time_limit_seconds,
      });
    }
  }

  const finalCandidates = (allPuzzles ?? []).filter((p) => p.round === "final");
  if (finalCandidates.length > 0) {
    const p = shuffle(finalCandidates)[0];
    rows.push({
      round: "final",
      order_index: cursor++,
      source_puzzle_id: p.id,
      puzzle_type: p.puzzle_type,
      display_text: p.display_text,
      answer_text: p.answer_text,
      accepted_answers: p.accepted_answers,
      points: p.points,
      time_limit_seconds: p.time_limit_seconds,
    });
  }

  return rows;
}

/**
 * Same idea for the Sprint (Round 4) pool: every rebus_sprint_puzzles row
 * from every set, shuffled together into one session-scoped pool. No cap
 * — matches the original single-set pool's "no fixed count, the two
 * players just race through as much of it as they can in 30 seconds."
 * Returns rows shaped for rebus_session_sprint_puzzles (session_id not
 * yet attached).
 */
export async function pickRebusSessionSprintPuzzles(admin: ReturnType<typeof getAdminClient>) {
  const { data: allSprint } = await admin.from("rebus_sprint_puzzles").select("*");
  return shuffle(allSprint ?? []).map((p, i) => ({
    order_index: i,
    source_sprint_puzzle_id: p.id,
    display_text: p.display_text,
    answer_text: p.answer_text,
    accepted_answers: p.accepted_answers,
  }));
}

/**
 * Computes a Rebus session's individual leaderboard: rounds 1-3 + Final
 * Round points come from summing rebus_answers, and Sprint (Round 4)
 * points are folded in on top for whichever two participants actually
 * played it — sprint_p1_points/sprint_p2_points live directly on the
 * session rather than as summable answer rows, since rebus_sprint_answers
 * is intentionally anti-cheat-isolated per player while the Sprint is
 * still in progress (see 0021_rebus_game.sql). By the time this is called
 * the Sprint numbers are final, so folding them in post-hoc is safe.
 */
export async function computeRebusLeaderboard(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data: participants } = await admin
    .from("rebus_participants")
    .select("user_id, team_id, profiles(username, avatar_url)")
    .eq("session_id", sessionId);

  const { data: answers } = await admin
    .from("rebus_answers")
    .select("user_id, points_awarded")
    .eq("session_id", sessionId);

  const { data: session } = await admin
    .from("rebus_sessions")
    .select("sprint_player1_id, sprint_player2_id, sprint_p1_points, sprint_p2_points")
    .eq("id", sessionId)
    .single();

  const totals = new Map<string, number>();
  for (const p of participants ?? []) totals.set(p.user_id, 0);
  for (const a of answers ?? []) {
    totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + (a.points_awarded ?? 0));
  }
  if (session?.sprint_player1_id) {
    totals.set(session.sprint_player1_id, (totals.get(session.sprint_player1_id) ?? 0) + (session.sprint_p1_points ?? 0));
  }
  if (session?.sprint_player2_id) {
    totals.set(session.sprint_player2_id, (totals.get(session.sprint_player2_id) ?? 0) + (session.sprint_p2_points ?? 0));
  }

  const profileMap = new Map((participants ?? []).map((p: any) => [p.user_id, p.profiles]));
  const teamMap = new Map((participants ?? []).map((p: any) => [p.user_id, p.team_id]));

  const leaderboard = Array.from(totals.entries())
    .map(([user_id, total_points]) => ({
      user_id,
      username: profileMap.get(user_id)?.username ?? "Unknown",
      avatar_url: profileMap.get(user_id)?.avatar_url ?? null,
      team_id: teamMap.get(user_id) ?? null,
      total_points,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return leaderboard;
}

/**
 * Team-mode standings — sums each team's members' totals from the
 * individual leaderboard above rather than re-querying, so the two never
 * disagree. Participants with no team (shouldn't normally happen once a
 * team-mode game has started) are simply excluded.
 */
export async function computeRebusTeamLeaderboard(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const individual = await computeRebusLeaderboard(admin, sessionId);
  const { data: teams } = await admin.from("rebus_teams").select("id, name").eq("session_id", sessionId);

  const totals = new Map<string, number>();
  for (const t of teams ?? []) totals.set(t.id, 0);
  for (const entry of individual) {
    if (entry.team_id) totals.set(entry.team_id, (totals.get(entry.team_id) ?? 0) + entry.total_points);
  }

  const nameMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return Array.from(totals.entries())
    .map(([team_id, total_points]) => ({ team_id, name: nameMap.get(team_id) ?? "Unknown team", total_points }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Computes a session's leaderboard by summing points_awarded per participant. */
export async function computeLeaderboard(admin: ReturnType<typeof getAdminClient>, sessionId: string) {
  const { data: participants } = await admin
    .from("session_participants")
    .select("user_id, profiles(username, avatar_url)")
    .eq("session_id", sessionId);

  const { data: answers } = await admin
    .from("answers")
    .select("user_id, points_awarded")
    .eq("session_id", sessionId);

  const totals = new Map<string, number>();
  for (const p of participants ?? []) totals.set(p.user_id, 0);
  for (const a of answers ?? []) {
    totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + (a.points_awarded ?? 0));
  }

  const profileMap = new Map(
    (participants ?? []).map((p: any) => [p.user_id, p.profiles])
  );

  const leaderboard = Array.from(totals.entries())
    .map(([user_id, total_points]) => ({
      user_id,
      username: profileMap.get(user_id)?.username ?? "Unknown",
      avatar_url: profileMap.get(user_id)?.avatar_url ?? null,
      total_points,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return leaderboard;
}
