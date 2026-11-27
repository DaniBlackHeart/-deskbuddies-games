// Generates the Daily Puzzle word lists. Run from a folder where `npm i wordlist-english an-array-of-english-words naughty-words` was done.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dir = "node_modules/wordlist-english/";
const BANDS = [10, 20, 35, 40, 50, 55, 60, 70];
const five = (w) => /^[a-z]{5}$/.test(w);
const read = (f) => JSON.parse(fs.readFileSync(dir + f, "utf8"));

// All SCOWL words of any length (used to recognise plural / past-tense forms)
const everyWord = new Set();
const answerBand = new Map(); // five-letter non-dialect words -> frequency band
for (const b of BANDS) for (const w of read(`english-words-${b}.json`)) { everyWord.add(w); if (five(w) && !answerBand.has(w)) answerBand.set(w, b); }

// Guess words: SCOWL (all dialects, up to band 70) + the dwyl list
const guess = new Set(answerBand.keys());
for (const d of ["american", "british", "canadian", "australian"])
  for (const b of BANDS) for (const w of read(`${d}-words-${b}.json`)) if (five(w)) guess.add(w);
for (const w of require("an-array-of-english-words")) if (five(w)) guess.add(w);

// Answer candidates: common bands only, no plain plurals or past-tense forms
const isInflection = (w) =>
  (w.endsWith("s") && everyWord.has(w.slice(0, -1))) ||
  (w.endsWith("ed") && (everyWord.has(w.slice(0, -1)) || everyWord.has(w.slice(0, -2)))) ||
  (w.endsWith("er") && everyWord.has(w.slice(0, -1)));      // nicer, safer, wider...
const naughty = new Set(require("naughty-words").en.map((x) => x.toLowerCase().trim()));
const manualBlock = new Set(fs.existsSync("blocklist.txt") ? fs.readFileSync("blocklist.txt", "utf8").split(/\s+/).filter(Boolean) : []);

const pool = [], flagged = [];
for (const [w, b] of answerBand) {
  if (b > 60 || isInflection(w)) continue;
  if (naughty.has(w) || manualBlock.has(w)) flagged.push(w); else pool.push([w, b]);
}
pool.sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0]));
const answers = pool.map((p) => p[0]);
// First 1,000: every word from the two most common bands, then a seeded random sample of the next band
// (a plain alphabetical cut would only reach words starting with a-b).
let seed = 20261127;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const top = pool.filter((p) => p[1] <= 20).map((p) => p[0]);
const next = pool.filter((p) => p[1] === 35).map((p) => p[0]);
for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
const first1000 = [...top, ...next.slice(0, 1000 - top.length)].sort();

fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/answers-first-1000.txt", first1000.join("\n") + "\n");
fs.writeFileSync("out/answers-pool.txt", answers.join("\n") + "\n");
fs.writeFileSync("out/guesses.txt", [...guess].sort().join("\n") + "\n");
fs.writeFileSync("out/flagged-for-review.txt", flagged.sort().join("\n") + "\n");
const missing = answers.filter((w) => !guess.has(w));
console.log({ guesses: guess.size, pool: answers.length, first1000: first1000.length, flagged: flagged.length, answersMissingFromGuesses: missing.length, fromBands10and20: top.length });
