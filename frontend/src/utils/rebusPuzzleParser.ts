// Parses a pasted block of "Type What You See" puzzles into a normalized
// shape ready to insert into rebus_puzzles. Mirrors questionParser.ts's
// two supported formats (JSON array, or a simple line-based template).
//
// Round and Type were dropped from both formats (2026-08-29, at Dani's
// request) — the import modal is always opened from inside one specific
// round tab in RebusSetEditorPage, so every puzzle in a single paste
// belongs to that same round; there's nothing left to specify per puzzle.
// puzzle_type isn't asked for either — every imported puzzle defaults to
// "phonetic" (same as the manual-add form's default), and a MOD can still
// pick a different type there if a puzzle needs one. Both the round and
// its points/time defaults are passed in by the caller instead of parsed
// from the pasted text.
//
// 1) JSON array of objects, e.g.:
//    [
//      { "display_text": "SIR USE LEE", "answer_text": "Seriously",
//        "accepted_answers": ["Seriously"], "points": 200, "time_limit_seconds": 10 }
//    ]
//
// 2) A plain-text template, one puzzle per blank-line-separated block:
//    Display: SIR USE LEE
//    Answer: Seriously
//    Accepted: Seriously
//    Points: 200
//    Time: 10

import type { RebusPuzzleType, RebusRound } from "../types";

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

// Defaults per round, matching the format Dani specified — MOD can still
// override points/time per puzzle in the JSON/template.
const ROUND_DEFAULTS: Record<RebusRound, { points: number; time_limit_seconds: number }> = {
  warmup: { points: 200, time_limit_seconds: 10 },
  round2: { points: 400, time_limit_seconds: 15 },
  round3: { points: 500, time_limit_seconds: 15 },
  final: { points: 1000, time_limit_seconds: 30 },
};

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
      puzzle_type: "phonetic",
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
      puzzle_type: "phonetic",
      display_text: display,
      answer_text: answer,
      accepted_answers: accepted,
      points: points ?? defaults.points,
      time_limit_seconds: timeLimit ?? defaults.time_limit_seconds,
    });
  });

  return { puzzles, errors };
}

export const REBUS_TEMPLATE_EXAMPLE = `Display: SIR USE LEE
Answer: Seriously

Display: TO GET HER
Answer: Together
Points: 450
Time: 12`;

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
