// Parses pasted input for Impostor WHO? content imports. Two shapes,
// mirroring questionParser.ts's "JSON or simple text template" split:
//
// 1) Word-only import (used inside a category editor, adding words to
//    the category already open):
//    - JSON array of strings and/or { "word": "...", "clue": "..." } objects
//    - Plain text, one word per line, with an optional clue after a pipe:
//      Elephant | Large gray mammal with a trunk
//      Giraffe
//
// 2) Bulk category+words import (used from the categories list, creating
//    whole new categories in one paste):
//    - JSON array of objects:
//      [{ "name": "Animals", "description": "...", "words": [
//          "Zebra", { "word": "Elephant", "clue": "Has a trunk" }
//      ] }]
//    - Plain text template, blank-line-separated blocks:
//      Category: Animals
//      Description: Creatures great and small
//      - Elephant | Large gray mammal with a trunk
//      - Giraffe
//      - Zebra
//
// The clue is what the Impostor sees as their one hint about the secret
// word (falls back to the category name at game time if left blank) — see
// 0013_impostor_word_clues.sql.

export type ParsedWord = { word: string; clue: string | null };
export type ParseResult = { words: ParsedWord[]; errors: string[] };

export const WORD_LIST_EXAMPLE = `Elephant | Large gray mammal with a trunk
Giraffe | Tallest land animal
Zebra
Penguin | Flightless bird that loves the cold
Kangaroo`;

export function parseWordListInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { words: [], errors: ["Nothing to import — paste some words first."] };

  if (trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (!Array.isArray(data)) return { words: [], errors: ["Expected a JSON array of words."] };
      const words = data.map(parseJsonWordEntry).filter((w): w is ParsedWord => w !== null && w.word.length > 0);
      if (words.length === 0) return { words: [], errors: ["That array has no usable words in it."] };
      return { words: dedupeWords(words), errors: [] };
    } catch (e) {
      return { words: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }

  const words = trimmed
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map(parseWordLine);
  if (words.length === 0) return { words: [], errors: ["No words found — one per line."] };
  return { words: dedupeWords(words), errors: [] };
}

function parseJsonWordEntry(item: unknown): ParsedWord | null {
  if (typeof item === "string") {
    return { word: item.trim(), clue: null };
  }
  if (item && typeof item === "object" && "word" in item) {
    const obj = item as { word: unknown; clue?: unknown };
    const word = String(obj.word ?? "").trim();
    const clue = obj.clue ? String(obj.clue).trim() : null;
    return { word, clue: clue || null };
  }
  return null;
}

// "Word | Clue text" — clue is everything after the first pipe, optional.
function parseWordLine(line: string): ParsedWord {
  const pipeIndex = line.indexOf("|");
  if (pipeIndex === -1) return { word: line.trim(), clue: null };
  const word = line.slice(0, pipeIndex).trim();
  const clue = line.slice(pipeIndex + 1).trim();
  return { word, clue: clue || null };
}

function dedupeWords(words: ParsedWord[]): ParsedWord[] {
  const seen = new Set<string>();
  const out: ParsedWord[] = [];
  for (const w of words) {
    const key = w.word.toLowerCase();
    if (!w.word || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export type ParsedCategory = { name: string; description: string | null; words: ParsedWord[] };
export type CategoryParseResult = { categories: ParsedCategory[]; errors: string[] };

export const CATEGORY_IMPORT_EXAMPLE = `Category: Animals
Description: Creatures great and small
- Elephant | Large gray mammal with a trunk
- Giraffe | Tallest land animal
- Zebra

Category: Movies
- Titanic | A ship that famously doesn't finish its voyage
- Jaws
- Inception`;

export function parseCategoryImportInput(raw: string): CategoryParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { categories: [], errors: ["Nothing to import — paste some categories first."] };

  if (trimmed.startsWith("[")) {
    return parseCategoryJson(trimmed);
  }
  return parseCategoryTemplate(trimmed);
}

function parseCategoryJson(trimmed: string): CategoryParseResult {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { categories: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const items = Array.isArray(data) ? data : [data];
  const errors: string[] = [];
  const categories: ParsedCategory[] = [];

  items.forEach((item: any, i) => {
    const label = `Item ${i + 1}`;
    if (!item?.name || typeof item.name !== "string") {
      errors.push(`${label}: missing "name"`);
      return;
    }
    if (!Array.isArray(item.words) || item.words.length === 0) {
      errors.push(`${label} ("${item.name}"): needs a non-empty "words" array`);
      return;
    }
    const words = dedupeWords(
      item.words.map(parseJsonWordEntry).filter((w: ParsedWord | null): w is ParsedWord => w !== null && w.word.length > 0)
    );
    if (words.length === 0) {
      errors.push(`${label} ("${item.name}"): no usable words`);
      return;
    }
    categories.push({ name: item.name.trim(), description: item.description ? String(item.description).trim() : null, words });
  });

  return { categories, errors };
}

function parseCategoryTemplate(trimmed: string): CategoryParseResult {
  const blocks = trimmed.split(/\n\s*\n/);
  const errors: string[] = [];
  const categories: ParsedCategory[] = [];

  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const label = `Block ${i + 1}`;
    const nameLine = lines.find((l) => /^category:/i.test(l));
    if (!nameLine) {
      errors.push(`${label}: missing a "Category: <name>" line`);
      return;
    }
    const name = nameLine.replace(/^category:/i, "").trim();
    if (!name) {
      errors.push(`${label}: category name is empty`);
      return;
    }

    const descLine = lines.find((l) => /^description:/i.test(l));
    const description = descLine ? descLine.replace(/^description:/i, "").trim() || null : null;

    const words = dedupeWords(
      lines
        .filter((l) => l !== nameLine && l !== descLine)
        .map((l) => l.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .map(parseWordLine)
    );

    if (words.length === 0) {
      errors.push(`${label} ("${name}"): no words found under it`);
      return;
    }

    categories.push({ name, description, words });
  });

  return { categories, errors };
}
