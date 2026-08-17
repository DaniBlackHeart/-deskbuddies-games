// Parses pasted input for Impostor WHO? content imports. Two shapes,
// mirroring questionParser.ts's "JSON or simple text template" split:
//
// 1) Word-only import (used inside a category editor, adding words to
//    the category already open):
//    - JSON array of strings: ["Elephant", "Giraffe", "Zebra"]
//    - Plain text, one word per line
//
// 2) Bulk category+words import (used from the categories list, creating
//    whole new categories in one paste):
//    - JSON array of objects:
//      [{ "name": "Animals", "description": "...", "words": ["Elephant", "Giraffe"] }]
//    - Plain text template, blank-line-separated blocks:
//      Category: Animals
//      Description: Creatures great and small
//      - Elephant
//      - Giraffe
//      - Zebra

export type ParseResult = { words: string[]; errors: string[] };

export const WORD_LIST_EXAMPLE = `Elephant
Giraffe
Zebra
Penguin
Kangaroo`;

export function parseWordListInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { words: [], errors: ["Nothing to import — paste some words first."] };

  if (trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (!Array.isArray(data)) return { words: [], errors: ["Expected a JSON array of words."] };
      const words = data.map((w) => String(w).trim()).filter(Boolean);
      if (words.length === 0) return { words: [], errors: ["That array has no usable words in it."] };
      return { words: dedupe(words), errors: [] };
    } catch (e) {
      return { words: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }

  const words = trimmed
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (words.length === 0) return { words: [], errors: ["No words found — one per line."] };
  return { words: dedupe(words), errors: [] };
}

function dedupe(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export type ParsedCategory = { name: string; description: string | null; words: string[] };
export type CategoryParseResult = { categories: ParsedCategory[]; errors: string[] };

export const CATEGORY_IMPORT_EXAMPLE = `Category: Animals
Description: Creatures great and small
- Elephant
- Giraffe
- Zebra

Category: Movies
- Titanic
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
    const words = dedupe(item.words.map((w: unknown) => String(w).trim()).filter(Boolean));
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

    const words = dedupe(
      lines
        .filter((l) => l !== nameLine && l !== descLine)
        .map((l) => l.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
    );

    if (words.length === 0) {
      errors.push(`${label} ("${name}"): no words found under it`);
      return;
    }

    categories.push({ name, description, words });
  });

  return { categories, errors };
}
