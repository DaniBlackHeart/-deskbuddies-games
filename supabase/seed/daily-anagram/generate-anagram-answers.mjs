// Generates the Letter Shuffle (daily anagram) answer list: 7 to 9 letter common words that have
// exactly one anagram in a big English word list, so "only the intended answer counts" is fair.
// Run from a folder where `npm i wordlist-english an-array-of-english-words naughty-words` was done.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dir = "node_modules/wordlist-english/";
const BANDS = [10, 20, 35, 40, 50, 55, 60, 70];
const DIALECTS = ["english", "american", "british", "canadian", "australian"];
const read = (f) => JSON.parse(fs.readFileSync(dir + f, "utf8"));
const az = (w) => /^[a-z]+$/.test(w);

const everyWord = new Set();      // the "big dictionary" used to detect other anagrams
const band = new Map();           // common-word band for candidate answers (English list only)
for (const d of DIALECTS) for (const b of BANDS) for (const w of read(`${d}-words-${b}.json`)) {
  if (!az(w)) continue; everyWord.add(w);
  if (d === "english" && !band.has(w)) band.set(w, b);
}
for (const w of require("an-array-of-english-words")) if (az(w)) everyWord.add(w);

const key = (w) => [...w].sort().join("");
const groups = new Map();
for (const w of everyWord) if (w.length >= 7 && w.length <= 9) { const k = key(w); groups.set(k, (groups.get(k) ?? 0) + 1); }

const naughty = new Set(require("naughty-words").en.map((x) => x.toLowerCase().trim()));
const manual = new Set(fs.readFileSync("blocklist-anagram.txt", "utf8").split(/\s+/).filter(Boolean));
const derived = (w) =>
  (w.endsWith("s") && everyWord.has(w.slice(0, -1))) ||
  (w.endsWith("ed") && (everyWord.has(w.slice(0, -1)) || everyWord.has(w.slice(0, -2)))) ||
  (w.endsWith("ing") && (everyWord.has(w.slice(0, -3)) || everyWord.has(w.slice(0, -3) + "e"))) ||
  (w.endsWith("ing") && w.length > 5 && w[w.length - 4] === w[w.length - 5] && everyWord.has(w.slice(0, -4))) ||
  (w.endsWith("ed") && w[w.length - 3] === w[w.length - 4] && everyWord.has(w.slice(0, -3))) ||
  (w.endsWith("es") && everyWord.has(w.slice(0, -2))) ||
  (w.endsWith("ly") && everyWord.has(w.slice(0, -2))) ||
  (w.endsWith("est") && (everyWord.has(w.slice(0, -3)) || everyWord.has(w.slice(0, -2)))) ||
  (w.endsWith("iest") && everyWord.has(w.slice(0, -4) + "y")) ||
  (w.endsWith("ier") && everyWord.has(w.slice(0, -3) + "y")) ||
  (w.endsWith("ies") && everyWord.has(w.slice(0, -3) + "y")) ||
  (w.endsWith("er") && everyWord.has(w.slice(0, -1)));

const keep = [], dropped = { multiAnagram: 0, derived: 0, flagged: 0 };
for (const [w, b] of band) {
  if (w.length < 7 || w.length > 9 || b > 20) continue;
  if (naughty.has(w) || manual.has(w) || [...naughty].some((n) => n.length > 4 && w.includes(n))) { dropped.flagged++; continue; }
  if (derived(w)) { dropped.derived++; continue; }
  if (groups.get(key(w)) !== 1) { dropped.multiAnagram++; continue; }
  keep.push(w);
}
keep.sort();
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/anagram-answers.txt", keep.join("\n") + "\n");
const byLen = {}; for (const w of keep) byLen[w.length] = (byLen[w.length] ?? 0) + 1;
console.log({ kept: keep.length, byLen, dropped });
