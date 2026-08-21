// Parses pasted input for Wheel of Fortune content imports. Same "JSON or
// simple text template" split as impostorParser.ts/questionParser.ts, but
// simpler — a phrase is just a string, no clue/answer-key field attached
// to it, so there's no pipe-delimited second field to parse out.
//
// 1) Phrase-only import (used inside a category editor, adding phrases to
//    the category already open):
//    - JSON array of strings (or { "phrase": "..." } objects)
//    - Plain text, one phrase per line:
//      A Trip Down Memory Lane
//      Better Late Than Never
//
// 2) Bulk category+phrases import (used from the categories list, creating
//    whole new categories in one paste):
//    - JSON array of objects:
//      [{ "name": "Movies", "description": "...", "phrases": [
//          "A Trip Down Memory Lane", { "phrase": "Better Late Than Never" }
//      ] }]
//    - Plain text template, blank-line-separated blocks:
//      Category: Movies
//      Description: Big screen favorites
//      - A Trip Down Memory Lane
//      - Better Late Than Never

export type PhraseParseResult = { phrases: string[]; errors: string[] };

export const PHRASE_LIST_EXAMPLE = `A Trip Down Memory Lane
Better Late Than Never
Piece Of Cake
Break A Leg`;

export function parsePhraseListInput(raw: string): PhraseParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { phrases: [], errors: ["Nothing to import — paste some phrases first."] };

  if (trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (!Array.isArray(data)) return { phrases: [], errors: ["Expected a JSON array of phrases."] };
      const phrases = data.map(parseJsonPhraseEntry).filter((p): p is string => !!p && p.length > 0);
      if (phrases.length === 0) return { phrases: [], errors: ["That array has no usable phrases in it."] };
      return { phrases: dedupePhrases(phrases), errors: [] };
    } catch (e) {
      return { phrases: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }

  const phrases = trimmed
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (phrases.length === 0) return { phrases: [], errors: ["No phrases found — one per line."] };
  return { phrases: dedupePhrases(phrases), errors: [] };
}

function parseJsonPhraseEntry(item: unknown): string | null {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && "phrase" in item) {
    const obj = item as { phrase: unknown };
    return String(obj.phrase ?? "").trim();
  }
  return null;
}

function dedupePhrases(phrases: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const key = p.toLowerCase();
    if (!p || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export type ParsedWheelCategory = { name: string; description: string | null; phrases: string[] };
export type WheelCategoryParseResult = { categories: ParsedWheelCategory[]; errors: string[] };

export const WHEEL_CATEGORY_IMPORT_EXAMPLE = `Category: Movies
Description: Big screen favorites
- A Trip Down Memory Lane
- Better Late Than Never
- Around The House

Category: Phrases
- Piece Of Cake
- Break A Leg
- Cost An Arm And A Leg`;

export function parseWheelCategoryImportInput(raw: string): WheelCategoryParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { categories: [], errors: ["Nothing to import — paste some categories first."] };
  if (trimmed.startsWith("[")) return parseWheelCategoryJson(trimmed);
  return parseWheelCategoryTemplate(trimmed);
}

function parseWheelCategoryJson(trimmed: string): WheelCategoryParseResult {
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (e) {
    return { categories: [], errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const items = Array.isArray(data) ? data : [data];
  const errors: string[] = [];
  const categories: ParsedWheelCategory[] = [];

  items.forEach((item: any, i) => {
    const label = `Item ${i + 1}`;
    if (!item?.name || typeof item.name !== "string") {
      errors.push(`${label}: missing "name"`);
      return;
    }
    if (!Array.isArray(item.phrases) || item.phrases.length === 0) {
      errors.push(`${label} ("${item.name}"): needs a non-empty "phrases" array`);
      return;
    }
    const phrases = dedupePhrases(
      item.phrases.map(parseJsonPhraseEntry).filter((p: string | null): p is string => !!p && p.length > 0)
    );
    if (phrases.length === 0) {
      errors.push(`${label} ("${item.name}"): no usable phrases`);
      return;
    }
    categories.push({ name: item.name.trim(), description: item.description ? String(item.description).trim() : null, phrases });
  });

  return { categories, errors };
}

function parseWheelCategoryTemplate(trimmed: string): WheelCategoryParseResult {
  const blocks = trimmed.split(/\n\s*\n/);
  const errors: string[] = [];
  const categories: ParsedWheelCategory[] = [];

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

    const phrases = dedupePhrases(
      lines
        .filter((l) => l !== nameLine && l !== descLine)
        .map((l) => l.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
    );

    if (phrases.length === 0) {
      errors.push(`${label} ("${name}"): no phrases found under it`);
      return;
    }

    categories.push({ name, description, phrases });
  });

  return { categories, errors };
}
