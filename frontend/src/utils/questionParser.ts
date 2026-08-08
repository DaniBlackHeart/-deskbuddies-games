// Parses a pasted block of questions into a normalized shape ready to
// insert into the `questions` table. Supports two input formats:
//
// 1) JSON array of objects, e.g.:
//    [
//      { "prompt": "Capital of France?", "type": "multiple_choice",
//        "choices": ["Paris","London","Berlin","Madrid"], "correct_choice": 0,
//        "points": 100, "time_limit_seconds": 20 },
//      { "prompt": "Largest planet?", "type": "typed",
//        "accepted_answers": ["Jupiter"], "points": 150 }
//    ]
//
// 2) A plain-text template, one question per blank-line-separated block:
//    Q: Capital of France?
//    Type: MC
//    A) Paris
//    B) London
//    C) Berlin
//    D) Madrid
//    Correct: A
//    Points: 100
//    Time: 20

export type ParsedQuestion = {
  prompt: string;
  type: "multiple_choice" | "typed";
  choices: string[] | null;
  correct_choice: number | null;
  accepted_answers: string[] | null;
  points: number;
  penalty_points: number; // deduction if wrong (used only in Hard mode sessions)
  time_limit_seconds: number;
};

export type ParseResult = {
  questions: ParsedQuestion[];
  errors: string[];
};

const DEFAULT_POINTS = 100;
const DEFAULT_TIME_LIMIT = 20;

export function parseQuestionInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { questions: [], errors: ["Nothing to import — paste some questions first."] };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed);
  }
  return parseTemplate(trimmed);
}

function parseJson(trimmed: string): ParseResult {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { questions: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const items = Array.isArray(data) ? data : [data];
  const questions: ParsedQuestion[] = [];

  items.forEach((item: any, i) => {
    const label = `Item ${i + 1}`;
    if (!item?.prompt || typeof item.prompt !== "string") {
      errors.push(`${label}: missing "prompt"`);
      return;
    }
    const type: string = item.type === "typed" ? "typed" : "multiple_choice";

    if (type === "multiple_choice") {
      if (!Array.isArray(item.choices) || item.choices.length < 2) {
        errors.push(`${label}: multiple_choice needs at least 2 "choices"`);
        return;
      }
      if (
        typeof item.correct_choice !== "number" ||
        item.correct_choice < 0 ||
        item.correct_choice >= item.choices.length
      ) {
        errors.push(`${label}: "correct_choice" must be a valid index into "choices"`);
        return;
      }
      const points = Number(item.points) || DEFAULT_POINTS;
      questions.push({
        prompt: item.prompt,
        type: "multiple_choice",
        choices: item.choices,
        correct_choice: item.correct_choice,
        accepted_answers: null,
        points,
        penalty_points: Number(item.penalty_points) || Math.round(points / 2),
        time_limit_seconds: Number(item.time_limit_seconds) || DEFAULT_TIME_LIMIT,
      });
    } else {
      if (!Array.isArray(item.accepted_answers) || item.accepted_answers.length === 0) {
        errors.push(`${label}: typed question needs at least 1 "accepted_answers" entry`);
        return;
      }
      const points = Number(item.points) || DEFAULT_POINTS;
      questions.push({
        prompt: item.prompt,
        type: "typed",
        choices: null,
        correct_choice: null,
        accepted_answers: item.accepted_answers,
        points,
        penalty_points: Number(item.penalty_points) || Math.round(points / 2),
        time_limit_seconds: Number(item.time_limit_seconds) || DEFAULT_TIME_LIMIT,
      });
    }
  });

  return { questions, errors };
}

function parseTemplate(trimmed: string): ParseResult {
  const blocks = trimmed.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, i) => {
    const label = `Question ${i + 1}`;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    let prompt: string | null = null;
    let explicitType: string | null = null;
    const choices: string[] = [];
    let correctLetter: string | null = null;
    let acceptedRaw: string | null = null;
    let points = DEFAULT_POINTS;
    let penaltyRaw: number | null = null;
    let timeLimit = DEFAULT_TIME_LIMIT;

    for (const line of lines) {
      const choiceMatch = line.match(/^([A-Fa-f])\)\s*(.+)$/);
      if (/^Q:/i.test(line)) {
        prompt = line.replace(/^Q:/i, "").trim();
      } else if (/^Type:/i.test(line)) {
        explicitType = line.replace(/^Type:/i, "").trim().toUpperCase();
      } else if (choiceMatch) {
        choices.push(choiceMatch[2].trim());
      } else if (/^Correct:/i.test(line)) {
        correctLetter = line.replace(/^Correct:/i, "").trim();
      } else if (/^Accepted:/i.test(line)) {
        acceptedRaw = line.replace(/^Accepted:/i, "").trim();
      } else if (/^Points:/i.test(line)) {
        points = Number(line.replace(/^Points:/i, "").trim()) || DEFAULT_POINTS;
      } else if (/^Penalty:/i.test(line)) {
        penaltyRaw = Number(line.replace(/^Penalty:/i, "").trim());
      } else if (/^Time:/i.test(line)) {
        timeLimit = Number(line.replace(/^Time:/i, "").trim()) || DEFAULT_TIME_LIMIT;
      } else if (!prompt) {
        // Allow a bare first line with no "Q:" prefix, for convenience.
        prompt = line;
      }
    }

    // Resolved after the loop since "Penalty:" might appear before "Points:"
    // in a pasted block — this way it always reflects the final points value.
    const penalty = penaltyRaw !== null && !Number.isNaN(penaltyRaw) ? penaltyRaw : Math.round(points / 2);

    if (!prompt) {
      errors.push(`${label}: couldn't find a question prompt (add a "Q: ..." line)`);
      return;
    }

    const resolvedType = explicitType === "TYPED" ? "typed" : explicitType === "MC" ? "multiple_choice" : choices.length > 0 ? "multiple_choice" : acceptedRaw ? "typed" : null;

    if (resolvedType === "multiple_choice") {
      if (choices.length < 2) {
        errors.push(`${label}: needs at least 2 choices (lines like "A) Paris")`);
        return;
      }
      if (!correctLetter) {
        errors.push(`${label}: missing "Correct: <letter>"`);
        return;
      }
      const correctIndex = correctLetter.toUpperCase().charCodeAt(0) - 65;
      if (correctIndex < 0 || correctIndex >= choices.length) {
        errors.push(`${label}: "Correct: ${correctLetter}" doesn't match any choice`);
        return;
      }
      questions.push({
        prompt,
        type: "multiple_choice",
        choices,
        correct_choice: correctIndex,
        accepted_answers: null,
        points,
        penalty_points: penalty,
        time_limit_seconds: timeLimit,
      });
    } else if (resolvedType === "typed") {
      if (!acceptedRaw) {
        errors.push(`${label}: missing "Accepted: <answer1, answer2, ...>"`);
        return;
      }
      const accepted = acceptedRaw.split(",").map((a) => a.trim()).filter(Boolean);
      questions.push({
        prompt,
        type: "typed",
        choices: null,
        correct_choice: null,
        accepted_answers: accepted,
        points,
        penalty_points: penalty,
        time_limit_seconds: timeLimit,
      });
    } else {
      errors.push(`${label}: couldn't tell if this is multiple choice or typed — add choices or "Accepted:"`);
    }
  });

  return { questions, errors };
}

export const TEMPLATE_EXAMPLE = `Q: What is the capital of France?
Type: MC
A) Paris
B) London
C) Berlin
D) Madrid
Correct: A
Points: 100
Penalty: 50
Time: 20

Q: Name the largest planet in our solar system.
Type: TYPED
Accepted: Jupiter
Points: 150
Time: 30`;
