// Parses a pasted block of "Type What You See" puzzles into a normalized
// shape ready to insert into rebus_puzzles. Mirrors questionParser.ts's
// two supported formats (JSON array, or a simple line-based template).
//
// 1) JSON array of objects, e.g.:
//    [
//      { "round": "warmup", "puzzle_type": "phonetic",
//        "display_text": "SIR USE LEE", "answer_text": "Seriously",
//        "accepted_answers": ["Seriously"], "points": 200, "time_limit_seconds": 10 }
//    ]
//
// 2) A plain-text template, one puzzle per blank-line-separated block:
//    Round: Warmup
//    Type: Phonetic
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

const ROUND_ALIASES: Record<string, RebusRound> = {
  warmup: "warmup",
  "warm-up": "warmup",
  "round1": "warmup",
  "round 1": "warmup",
  "1": "warmup",
  round2: "round2",
  "round 2": "round2",
  "2": "round2",
  round3: "round3",
  "round 3": "round3",
  "3": "round3",
  final: "final",
  "final round": "final",
  "big puzzle": "final",
  "the big puzzle": "final",
};

const TYPE_ALIASES: Record<string, RebusPuzzleType> = {
  phonetic: "phonetic",
  split: "split",
  "split words": "split",
  numbers_letters: "numbers_letters",
  "numbers & letters": "numbers_letters",
  "numbers and letters": "numbers_letters",
  visual: "visual",
  "visual arrangement": "visual",
  missing_letters: "missing_letters",
  "missing letters": "missing_letters",
  repeated: "repeated",
  "repeated words": "repeated",
  homophone: "homophone",
  homophones: "homophone",
};

function resolveRound(raw: string | undefined): RebusRound | null {
  if (!raw) return null;
  return ROUND_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function resolveType(raw: string | undefined): RebusPuzzleType {
  if (!raw) return "phonetic";
  return TYPE_ALIASES[raw.trim().toLowerCase()] ?? "phonetic";
}

export function parseRebusPuzzleInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { puzzles: [], errors: ["Nothing to import — paste some puzzles first."] };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed);
  }
  return parseTemplate(trimmed);
}

function parseJson(trimmed: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { puzzles: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const items = Array.isArray(data) ? data : [data];
  const puzzles: ParsedRebusPuzzle[] = [];
  const errors: string[] = [];

  items.forEach((item: any, i) => {
    const label = `Item ${i + 1}`;
    const round = resolveRound(item?.round);
    if (!round) {
      errors.push(`${label}: missing or invalid "round" (warmup, round2, round3, final)`);
      return;
    }
    if (!item?.display_text || typeof item.display_text !== "string") {
      errors.push(`${label}: missing "display_text"`);
      return;
    }
    if (!item?.answer_text || typeof item.answer_text !== "string") {
      errors.push(`${label}: missing "answer_text"`);
      return;
    }
    const defaults = ROUND_DEFAULTS[round];
    puzzles.push({
      round,
      puzzle_type: resolveType(item.puzzle_type),
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

function parseTemplate(trimmed: string): ParseResult {
  const blocks = trimmed.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const puzzles: ParsedRebusPuzzle[] = [];
  const errors: string[] = [];

  blocks.forEach((block, i) => {
    const label = `Puzzle ${i + 1}`;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    let roundRaw: string | null = null;
    let typeRaw: string | null = null;
    let display: string | null = null;
    let answer: string | null = null;
    let acceptedRaw: string | null = null;
    let points: number | null = null;
    let timeLimit: number | null = null;

    for (const line of lines) {
      if (/^Round:/i.test(line)) roundRaw = line.replace(/^Round:/i, "").trim();
      else if (/^Type:/i.test(line)) typeRaw = line.replace(/^Type:/i, "").trim();
      else if (/^Display:/i.test(line)) display = line.replace(/^Display:/i, "").trim();
      else if (/^Answer:/i.test(line)) answer = line.replace(/^Answer:/i, "").trim();
      else if (/^Accepted:/i.test(line)) acceptedRaw = line.replace(/^Accepted:/i, "").trim();
      else if (/^Points:/i.test(line)) points = Number(line.replace(/^Points:/i, "").trim()) || null;
      else if (/^Time:/i.test(line)) timeLimit = Number(line.replace(/^Time:/i, "").trim()) || null;
      else if (!display) display = line; // allow a bare first line
    }

    const round = resolveRound(roundRaw ?? undefined);
    if (!round) {
      errors.push(`${label}: missing or invalid "Round: <Warmup|Round2|Round3|Final>"`);
      return;
    }
    if (!display) {
      errors.push(`${label}: missing "Display: <puzzle text>"`);
      return;
    }
    if (!answer) {
      errors.push(`${label}: missing "Answer: <the hidden word/phrase>"`);
      return;
    }

    const defaults = ROUND_DEFAULTS[round];
    const accepted = acceptedRaw
      ? acceptedRaw.split(",").map((a) => a.trim()).filter(Boolean)
      : [answer];

    puzzles.push({
      round,
      puzzle_type: resolveType(typeRaw ?? undefined),
      display_text: display,
      answer_text: answer,
      accepted_answers: accepted,
      points: points ?? defaults.points,
      time_limit_seconds: timeLimit ?? defaults.time_limit_seconds,
    });
  });

  return { puzzles, errors };
}

export const REBUS_TEMPLATE_EXAMPLE = `Round: Warmup
Type: Phonetic
Display: SIR USE LEE
Answer: Seriously
Points: 200
Time: 10

Round: Round2
Type: Split
Display: TO GET HER
Answer: Together
Points: 400
Time: 15`;

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
