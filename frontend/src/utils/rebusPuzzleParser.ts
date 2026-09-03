// Parses a pasted block of "Type What You See" puzzles into a normalized
// shape ready to insert into rebus_puzzles. Mirrors questionParser.ts's
// two supported formats (JSON array, or a simple line-based template).
//
// Round/difficulty is still not part of either format's per-puzzle text —
// every puzzle in one paste shares a single round, same as always — but
// where that round comes from changed twice the same day (2026-08-29):
// first inferred from whichever round tab the import modal was opened
// from, then (once sets dropped their per-round tabs entirely in favor of
// one flat puzzle list) a difficulty dropdown inside the import modal
// itself. Either way, the round and its points/time defaults are passed
// in by the caller (parseRebusPuzzleInput's `round` argument) instead of
// parsed from the pasted text.
//
// Type is optional in both formats — pasted puzzles are NOT all just
// tagged "phonetic": detectPuzzleType() below guesses the type from the
// puzzle's own display_text (a line break → Visual arrangement, digits →
// Numbers & letters, an underscore → Missing letters, the same word
// repeated → Repeated words, a single word → Homophone, otherwise →
// Phonetic) whenever a puzzle doesn't say its type explicitly. It's a
// heuristic, not a real classifier, and RebusImportModal shows the
// resolved type per puzzle in the preview so a MOD can catch a bad guess
// before confirming — there's no per-puzzle edit after import (see
// RebusSetEditorPage), only delete-and-redo, so that preview step
// matters. One known gap the guess can't resolve on its own: "split
// words" puzzles are laid out with line breaks exactly like "visual
// arrangement" ones, so there's no textual signal that tells them apart —
// a multi-line puzzle with no explicit Type: is always guessed as Visual.
// Say `Type: split` on that puzzle (or add it manually) if you need that
// exact tag instead.
//
// 1) JSON array of objects, e.g.:
//    [
//      { "display_text": "SIR USE LEE", "answer_text": "Seriously",
//        "accepted_answers": ["Seriously"], "points": 200, "time_limit_seconds": 10,
//        "puzzle_type": "phonetic" }
//    ]
//    display_text may contain "\n" for a multi-line (Visual/Split-shaped)
//    puzzle. `puzzle_type` is optional — omit it to let detectPuzzleType
//    guess, same as the plain-text template below.
//
// 2) A plain-text template. Every puzzle starts a new "Display:" line —
//    that's the only thing that marks a new puzzle, not a blank line
//    (blank lines between puzzles are fine and ignored, but not
//    required — a paste with zero blank lines in it, like a straight
//    copy from a spreadsheet or another chat, still splits correctly).
//    Any line after "Display:" that isn't itself a recognized field
//    ("Answer:"/"Accepted:"/"Points:"/"Time:"/"Type:") is treated as
//    another line of the display text — this is how a Visual or Split
//    puzzle's line break is expressed here, no JSON required:
//
//    Display: SIR USE LEE
//    Answer: Seriously
//    Accepted: Seriously
//    Points: 200
//    Time: 10
//
//    Display: MIND
//    MATTER
//    Answer: Mind over matter
//    Type: visual

import type { RebusPuzzleType, RebusRound } from "../types";

export const REBUS_PUZZLE_TYPE_LABELS: Record<RebusPuzzleType, string> = {
  phonetic: "Phonetic",
  split: "Split words",
  numbers_letters: "Numbers & letters",
  visual: "Visual arrangement",
  missing_letters: "Missing letters",
  repeated: "Repeated words",
  homophone: "Homophone",
};

// Difficulty labels for the `round` field — "round" is still the column
// name (unchanged, to avoid a migration) but a set no longer has separate
// per-round authoring tabs (2026-08-29, at Dani's request): every puzzle
// in a set is one flat list now, with its difficulty picked per-puzzle
// via a dropdown using these labels, both in the manual "Add puzzle" form
// and the import modal. Shared here so the two stay in sync.
export const REBUS_DIFFICULTY_LABELS: Record<RebusRound, string> = {
  warmup: "Easy",
  round2: "Medium",
  round3: "Hard",
  final: "Final Round",
};

export const REBUS_DIFFICULTY_ORDER: RebusRound[] = ["warmup", "round2", "round3", "final"];

// One example per type, shared by the manual "Add puzzle" form (where a
// MOD picks the type directly) and the import modal's reference block
// (where the type is only ever guessed — see detectPuzzleType).
export const REBUS_TYPE_EXAMPLES: Record<RebusPuzzleType, { display: string; answer: string }> = {
  phonetic: { display: "SIR USE LEE", answer: "Seriously" },
  split: { display: "STAND\nI", answer: "Understand" },
  numbers_letters: { display: "2GETHER", answer: "Together" },
  visual: { display: "MIND\nMATTER", answer: "Mind over matter" },
  missing_letters: { display: "CH_ISTMAS", answer: "Christmas" },
  repeated: { display: "CYCLE CYCLE CYCLE", answer: "Tricycle" },
  homophone: { display: "EWE", answer: "You" },
};

/**
 * Guesses a puzzle's type from its display text, since bulk import never
 * asks for one. First match wins:
 *   1. more than one line             -> visual (JSON only — see above)
 *   2. an underscore anywhere         -> missing_letters
 *   3. any digit                      -> numbers_letters
 *   4. the same word repeated 2+ times -> repeated
 *   5. a single word (no spaces)      -> homophone
 *   6. otherwise                      -> phonetic
 * Imperfect on purpose — it's meant to save typing on the common case, not
 * to be authoritative. The import preview always shows the guess so a MOD
 * can catch a wrong one before confirming.
 */
export function detectPuzzleType(display: string): RebusPuzzleType {
  const text = display.trim();
  if (/\n/.test(text)) return "visual";
  if (text.includes("_")) return "missing_letters";
  if (/\d/.test(text)) return "numbers_letters";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.every((w) => w.toLowerCase() === words[0].toLowerCase())) return "repeated";
  if (words.length === 1) return "homophone";
  return "phonetic";
}

const REBUS_TYPE_SLUGS = Object.keys(REBUS_PUZZLE_TYPE_LABELS) as RebusPuzzleType[];

// Accepts an explicit `Type:` (template) or `puzzle_type` (JSON) value and
// resolves it to one of the 7 real type slugs, tolerating the slug itself
// ("numbers_letters"), its human label ("Numbers & letters"), spaces
// instead of underscores, and mixed case — anything a MOD might
// reasonably type. Returns null if it doesn't match anything recognized,
// so the caller can surface a clear per-puzzle error instead of silently
// guessing against the MOD's stated intent.
function normalizePuzzleType(raw: string): RebusPuzzleType | null {
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  const bySlug = REBUS_TYPE_SLUGS.find((slug) => slug === normalized);
  if (bySlug) return bySlug;
  const byLabel = REBUS_TYPE_SLUGS.find(
    (slug) => REBUS_PUZZLE_TYPE_LABELS[slug].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") === normalized
  );
  return byLabel ?? null;
}

export type ParsedRebusPuzzle = {
  round: RebusRound;
  puzzle_type: RebusPuzzleType;
  display_text: string;
  answer_text: string;
  accepted_answers: string[];
  points: number;
  time_limit_seconds: number;
};

export type ParseResult = {
  puzzles: ParsedRebusPuzzle[];
  errors: string[];
};

// Defaults per round/difficulty, matching the format Dani specified — MOD
// can still override points/time per puzzle in the JSON/template, or in
// the manual add form. Exported (not just used internally) so
// RebusSetEditorPage.tsx has one source of truth instead of its own copy.
export const REBUS_ROUND_DEFAULTS: Record<RebusRound, { points: number; time_limit_seconds: number }> = {
  warmup: { points: 200, time_limit_seconds: 10 },
  round2: { points: 400, time_limit_seconds: 15 },
  round3: { points: 500, time_limit_seconds: 15 },
  final: { points: 1000, time_limit_seconds: 30 },
};
const ROUND_DEFAULTS = REBUS_ROUND_DEFAULTS;

// `defaultType`, when set, applies to every puzzle in this batch that
// doesn't say its own type ("Type:"/"puzzle_type") — for a paste that's
// entirely one style (a whole "visual arrangement" set, say), this saves
// tagging every single line individually. A puzzle's own explicit type
// still wins over this batch default, so a mostly-uniform paste can still
// call out the odd exception.
export function parseRebusPuzzleInput(raw: string, round: RebusRound, defaultType?: RebusPuzzleType): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { puzzles: [], errors: ["Nothing to import — paste some puzzles first."] };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed, round, defaultType);
  }
  return parseTemplate(trimmed, round, defaultType);
}

function parseJson(trimmed: string, round: RebusRound, defaultType?: RebusPuzzleType): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { puzzles: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const items = Array.isArray(data) ? data : [data];
  const puzzles: ParsedRebusPuzzle[] = [];
  const errors: string[] = [];
  const defaults = ROUND_DEFAULTS[round];

  items.forEach((item: any, i) => {
    const label = `Item ${i + 1}`;
    if (!item?.display_text || typeof item.display_text !== "string") {
      errors.push(`${label}: missing "display_text"`);
      return;
    }
    if (!item?.answer_text || typeof item.answer_text !== "string") {
      errors.push(`${label}: missing "answer_text"`);
      return;
    }

    let puzzleType: RebusPuzzleType;
    if (typeof item.puzzle_type === "string" && item.puzzle_type.trim()) {
      const normalized = normalizePuzzleType(item.puzzle_type);
      if (!normalized) {
        errors.push(`${label}: unrecognized "puzzle_type" "${item.puzzle_type}"`);
        return;
      }
      puzzleType = normalized;
    } else {
      puzzleType = defaultType ?? detectPuzzleType(item.display_text);
    }

    puzzles.push({
      round,
      puzzle_type: puzzleType,
      display_text: item.display_text,
      answer_text: item.answer_text,
      accepted_answers: Array.isArray(item.accepted_answers) && item.accepted_answers.length > 0
        ? item.accepted_answers
        : [item.answer_text],
      points: Number(item.points) || defaults.points,
      time_limit_seconds: Number(item.time_limit_seconds) || defaults.time_limit_seconds,
    });
  });

  return { puzzles, errors };
}

// A single puzzle's fields as they're accumulated line by line. displayLines
// is an array (not a string) specifically so a Visual/Split puzzle's line
// break survives: every unlabeled line encountered right after "Display:"
// (or before any label, for a bare first line) gets pushed here instead of
// being dropped, and the final display_text joins them with "\n".
type TemplateDraft = {
  displayLines: string[];
  answer: string | null;
  acceptedRaw: string | null;
  points: number | null;
  timeLimit: number | null;
  typeRaw: string | null;
};

function parseTemplate(trimmed: string, round: RebusRound, defaultType?: RebusPuzzleType): ParseResult {
  // Deliberately NOT split into blocks by blank line first — a paste with
  // no blank lines between puzzles at all (e.g. straight from a
  // spreadsheet or another chat) is common and shouldn't silently merge
  // every puzzle into one. Instead, "Display:" itself is the only thing
  // that starts a new puzzle: every time one is seen, whatever puzzle was
  // being built is finalized first. Blank lines are still fine to include
  // for readability — they're just skipped like any other empty line.
  const lines = trimmed.split("\n");
  const puzzles: ParsedRebusPuzzle[] = [];
  const errors: string[] = [];
  const defaults = ROUND_DEFAULTS[round];

  let draft: TemplateDraft | null = null;
  let count = 0;

  function newDraft(firstDisplayLine: string): TemplateDraft {
    return { displayLines: [firstDisplayLine], answer: null, acceptedRaw: null, points: null, timeLimit: null, typeRaw: null };
  }

  function flush() {
    if (!draft) return;
    count += 1;
    const label = `Puzzle ${count}`;
    const current = draft;
    draft = null;

    const display = current.displayLines.join("\n").trim();
    if (!display) {
      errors.push(`${label}: missing "Display: <puzzle text>"`);
      return;
    }
    if (!current.answer) {
      errors.push(`${label}: missing "Answer: <the hidden word/phrase>"`);
      return;
    }

    let puzzleType: RebusPuzzleType;
    if (current.typeRaw) {
      const normalized = normalizePuzzleType(current.typeRaw);
      if (!normalized) {
        errors.push(
          `${label}: unrecognized "Type: ${current.typeRaw}" — expected one of ${REBUS_TYPE_SLUGS.join(", ")}`
        );
        return;
      }
      puzzleType = normalized;
    } else {
      puzzleType = defaultType ?? detectPuzzleType(display);
    }

    const accepted = current.acceptedRaw
      ? current.acceptedRaw.split(",").map((a) => a.trim()).filter(Boolean)
      : [current.answer];

    puzzles.push({
      round,
      puzzle_type: puzzleType,
      display_text: display,
      answer_text: current.answer,
      accepted_answers: accepted,
      points: current.points ?? defaults.points,
      time_limit_seconds: current.timeLimit ?? defaults.time_limit_seconds,
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue; // blank lines are just visual spacing now, never required

    if (/^Display:/i.test(line)) {
      flush(); // a new "Display:" always starts the next puzzle
      draft = newDraft(line.replace(/^Display:/i, "").trim());
      continue;
    }
    if (!draft) {
      // No "Display:" prefix on this puzzle's first line — allow it, same
      // as before, treating the bare line itself as the start of Display.
      draft = newDraft(line);
      continue;
    }
    if (/^Answer:/i.test(line)) draft.answer = line.replace(/^Answer:/i, "").trim();
    else if (/^Accepted:/i.test(line)) draft.acceptedRaw = line.replace(/^Accepted:/i, "").trim();
    else if (/^Points:/i.test(line)) draft.points = Number(line.replace(/^Points:/i, "").trim()) || null;
    else if (/^Time:/i.test(line)) draft.timeLimit = Number(line.replace(/^Time:/i, "").trim()) || null;
    else if (/^Type:/i.test(line)) draft.typeRaw = line.replace(/^Type:/i, "").trim();
    else draft.displayLines.push(line); // continuation of a multi-line Display
  }
  flush();

  return { puzzles, errors };
}

// A line break under "Display:" (before the next recognized field) is
// part of the display text — that's how Visual/Split puzzles are written
// here, no JSON needed. "Type:" is only shown on the two puzzles whose
// type the guesser genuinely can't resolve on its own (Split looks
// identical to Visual once pasted); leave it off anywhere else and
// detectPuzzleType() guesses it, same as always. Blank lines between
// puzzles are just for readability — "Display:" is what actually starts
// a new one, so a paste with none still splits correctly.
export const REBUS_TEMPLATE_EXAMPLE = `Display: SIR USE LEE
Answer: Seriously

Display: TO GET HER
Answer: Together
Points: 450
Time: 12

Display: ${REBUS_TYPE_EXAMPLES.numbers_letters.display}
Answer: ${REBUS_TYPE_EXAMPLES.numbers_letters.answer}

Display: ${REBUS_TYPE_EXAMPLES.missing_letters.display}
Answer: ${REBUS_TYPE_EXAMPLES.missing_letters.answer}

Display: ${REBUS_TYPE_EXAMPLES.repeated.display}
Answer: ${REBUS_TYPE_EXAMPLES.repeated.answer}

Display: ${REBUS_TYPE_EXAMPLES.homophone.display}
Answer: ${REBUS_TYPE_EXAMPLES.homophone.answer}

Display: ${REBUS_TYPE_EXAMPLES.visual.display}
Answer: ${REBUS_TYPE_EXAMPLES.visual.answer}

Display: ${REBUS_TYPE_EXAMPLES.split.display}
Answer: ${REBUS_TYPE_EXAMPLES.split.answer}
Type: split`;

// The JSON format still works exactly the same way and is still useful
// for a very large machine-generated batch — display_text just carries
// "\n" directly instead of a real line break, and puzzle_type is the
// same optional override as "Type:" above.
export const REBUS_JSON_MULTILINE_EXAMPLE = `[
  { "display_text": "${REBUS_TYPE_EXAMPLES.visual.display.replace(/\n/g, "\\n")}",
    "answer_text": "${REBUS_TYPE_EXAMPLES.visual.answer}" },
  { "display_text": "${REBUS_TYPE_EXAMPLES.split.display.replace(/\n/g, "\\n")}",
    "answer_text": "${REBUS_TYPE_EXAMPLES.split.answer}",
    "puzzle_type": "split" }
]`;

// --- Sprint pool (Round 4) — simpler content, no round/type/points/time ---

export type ParsedRebusSprintPuzzle = {
  display_text: string;
  answer_text: string;
  accepted_answers: string[];
};

/**
 * One sprint puzzle per non-empty line: "DISPLAY :: ANSWER" or
 * "DISPLAY :: ANSWER :: alt1, alt2". Deliberately simpler than the main
 * puzzle template — the Sprint pool has no round/type/points/time to set.
 */
export function parseRebusSprintInput(raw: string): { puzzles: ParsedRebusSprintPuzzle[]; errors: string[] } {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { puzzles: [], errors: ["Nothing to import — paste some puzzles first."] };

  const puzzles: ParsedRebusSprintPuzzle[] = [];
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const parts = line.split("::").map((p) => p.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push(`Line ${i + 1}: expected "DISPLAY :: ANSWER" — got "${line}"`);
      return;
    }
    const accepted = parts[2] ? parts[2].split(",").map((a) => a.trim()).filter(Boolean) : [parts[1]];
    puzzles.push({ display_text: parts[0], answer_text: parts[1], accepted_answers: accepted });
  });

  return { puzzles, errors };
}

export const REBUS_SPRINT_TEMPLATE_EXAMPLE = `GR8 :: Great
2 + NIGHT :: Tonight :: Tonight
L + 8 + R :: Later`;
