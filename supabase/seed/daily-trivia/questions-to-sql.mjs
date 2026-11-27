// Turns a questions CSV into one SQL file you can run (or save as the next migration).
//   node supabase/seed/daily-trivia/questions-to-sql.mjs questions.csv > supabase/migrations/00NN_daily_trivia_questions.sql
//
// Columns (see questions-template.csv):
//   type              multiple_choice | typed
//   category          free text, optional
//   prompt            the question
//   choice_a..d       multiple choice only; leave a later one blank for fewer than 4 choices
//   correct           A, B, C or D (multiple choice only)
//   accepted_answers  typed only; separate spellings with a | (pipe), e.g.  Paris|City of Paris
//   scheduled_for     optional YYYY-MM-DD to pin the question to one day
// Rows whose category starts with "EXAMPLE" are skipped. Any problem stops the script and says which row.
// Typed answers are matched like Trivia Night: case, accents and punctuation are ignored.
import { readFileSync } from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const file = process.argv[2];
if (!file) { console.error("Usage: node questions-to-sql.mjs questions.csv"); process.exit(1); }
const [head, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
for (const need of ["type", "prompt"]) if (!(need in col)) { console.error(`Missing column: ${need}`); process.exit(1); }
const get = (r, k) => (k in col ? (r[col[k]] ?? "").trim() : "");
const q = (s) => `$q$${s}$q$`;
const j = (v) => q(JSON.stringify(v)) + "::jsonb";

const out = [];
rows.forEach((r, idx) => {
  const n = idx + 2; // spreadsheet row number
  const cat = get(r, "category");
  if (/^example/i.test(cat)) return;
  const fail = (m) => { console.error(`Row ${n}: ${m}`); process.exit(1); };
  const type = get(r, "type");
  const prompt = get(r, "prompt");
  if (!prompt) fail("prompt is empty");
  const sched = get(r, "scheduled_for");
  if (sched && !/^\d{4}-\d{2}-\d{2}$/.test(sched)) fail("scheduled_for must be YYYY-MM-DD");
  let choices = "null", correct = "null", accepted = "null";
  if (type === "multiple_choice") {
    const list = ["choice_a", "choice_b", "choice_c", "choice_d"].map((k) => get(r, k)).filter(Boolean);
    if (list.length < 2) fail("needs at least two choices");
    if (new Set(list.map((x) => x.toLowerCase())).size !== list.length) fail("two choices are the same");
    const idxC = "ABCD".indexOf(get(r, "correct").toUpperCase());
    if (idxC < 0 || idxC >= list.length) fail("correct must be A, B, C or D and match a filled choice");
    choices = j(list); correct = String(idxC);
  } else if (type === "typed") {
    const list = get(r, "accepted_answers").split("|").map((x) => x.trim()).filter(Boolean);
    if (list.length < 1) fail("accepted_answers is empty");
    accepted = j(list);
  } else fail("type must be multiple_choice or typed");
  out.push(`  (${q(type)}, ${cat ? q(cat) : "null"}, ${q(prompt)}, ${choices}, ${correct}, ${accepted}, ${sched ? `'${sched}'` : "null"})`);
});

if (out.length === 0) { console.error("No questions found (example rows are skipped)."); process.exit(1); }
console.log(`-- Daily Trivia questions, generated from ${file.split("/").pop()} (${out.length} questions).
-- Safe to review before running. Run it ONCE: running it again would add every question a second time.
insert into daily.trivia_questions (type, category, prompt, choices, correct_choice, accepted_answers, scheduled_for) values
${out.join(",\n")};
`);
