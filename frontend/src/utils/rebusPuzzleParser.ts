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
// Type was dropped too, but — per Dani's follow-up the same day — pasted
// puzzles are NOT all just tagged "phonetic": detectPuzzleType() below
// guesses the type from the puzzle's own display_text (digits → Numbers &
// letters, an underscore → Missing letters, the same word repeated →
// Repeated words, a single word → Homophone, multiple lines → Visual
// arrangement, otherwise → Phonetic). It's a heuristic, not a real
// classifier, and RebusImportModal shows the guessed type per puzzle in
// the preview so a MOD can catch a bad guess before confirming — there's
// no per-puzzle edit after import (see RebusSetEditorPage), only
// delete-and-redo, so that preview step matters. One known gap: "split
// words" puzzles are laid out with line breaks exactly like "visual
// arrangement" ones, so there's no textual signal that tells them apart —
// a multi-line puzzle always lands as Visual. Add a Split puzzle manually
// instead if you need that exact tag (same escape hatch as any other
// type).
//
// 1) JSON array of objects, e.g.:
//    [
//      { "display_text": "SIR USE LEE", "answer_text": "Seriously",
//        "accepted_answers": ["Seriously"], "points": 200, "time_limit_seconds": 10 }
//    ]
//    display_text may contain "\n" for a multi-line (Visual/Split-shaped)
//    puzzle — the plain-text template below can't represent that, since
//    its line-based format only ever reads one line per "Display:".
//
// 2) A plain-text template, one puzzle per blank-line-separated block:
//    Display: SIR USE LEE
//    Answer: Seriously
//    Accepted: Seriously
//    Points: 200
//    Time: 10

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

export function parseRebusPuzzleInput(raw: string, round: RebusRound): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { puzzles: [], errors: ["Nothing to import — paste some puzzles first."] };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed, round);
  }
  return parseTemplate(trimmed, round);
}

function parseJson(trimmed: string, round: RebusRound): ParseResult {
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
    puzzles.push({
      round,
      puzzle_type: detectPuzzleType(item.display_text),
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

function parseTemplate(trimmed: string, round: RebusRound): ParseResult {
  const blocks = trimmed.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const puzzles: ParsedRebusPuzzle[] = [];
  const errors: string[] = [];
  const defaults = ROUND_DEFAULTS[round];

  blocks.forEach((block, i) => {
    const label = `Puzzle ${i + 1}`;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    let display: string | null = null;
    let answer: string | null = null;
    let acceptedRaw: string | null = null;
    let points: number | null = null;
    let timeLimit: number | null = null;

    for (const line of lines) {
      if (/^Display:/i.test(line)) display = line.replace(/^Display:/i, "").trim();
      else if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:/i, "").trim();
      else if (/^Accepted:/i.test(line)) acceptedRaw = line.replace(/^Accepted:/i, "").trim();
      else if (/^Points:/i.test(line)) points = Number(line.replace(/^Points:/i, "").trim()) || null;
      else if (/^Time:/i.test(line)) timeLimit = Number(line.replace(/^Time:/i, "").trim()) || null;
      else if (!display) display = line; // allow a bare first line
    }

    if (!display) {
      errors.push(`${label}: missing "Display: <puzzle text>"`);
      return;
    }
    if (!answer) {
      errors.push(`${label}: missing "Answer: <the hidden word/phrase>"`);
      return;
    }

    const accepted = acceptedRaw
      ? acceptedRaw.split(",").map((a) => a.trim()).filter(Boolean)
      : [answer];

    puzzles.push({
      round,
      puzzle_type: detectPuzzleType(display),
      display_text: display,
      answer_text: answer,
      accepted_answers: accepted,
      points: points ?? defaults.points,
      time_limit_seconds: timeLimit ?? defaults.time_limit_seconds,
    });
  });

  return { puzzles, errors };
}

// Covers every type detectPuzzleType() can actually reach from a single
// line of text — Visual/Split need a real line break in display_text,
// which this plain-text format has no syntax for (see the file header),
// so those two aren't shown here; REBUS_JSON_MULTILINE_EXAMPLE below is
// the way to paste one of those instead.
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
Answer: ${REBUS_TYPE_EXAMPLES.homophone.answer}`;

// A Visual/Split-shaped puzzle needs a real newline in display_text, which
// only the JSON format can carry — shown separately since pasting it as-is
// alongside the plain-text template above would be invalid input.
export const REBUS_JSON_MULTILINE_EXAMPLE = `[
  { "display_text": "${REBUS_TYPE_EXAMPLES.visual.display.replace(/\n/g, "\\n")}",
    "answer_text": "${REBUS_TYPE_EXAMPLES.visual.answer}" }
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
