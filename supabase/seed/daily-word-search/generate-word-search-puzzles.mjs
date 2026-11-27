// Builds Word Hunt (daily word search) puzzles from scratch: a 10x10 grid, 8 words of 4 to 8 letters,
// words run right, down or diagonally down-right (never backwards). Every word appears exactly once in the
// whole grid (any direction, forwards or reversed), so there is exactly one place to find it, and no
// accidental unkind words show up in the filler letters.
//   node generate-word-search-puzzles.mjs [count] [seed] > puzzles.tsv
// Output columns: grid(100 letters) <TAB> words (comma list) <TAB> start cells <TAB> end cells (0-99, row by row)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const count = Number(process.argv[2] ?? 365);
let seed = Number(process.argv[3] ?? 2026) >>> 0;
const rand = () => { // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (n) => Math.floor(rand() * n);

const N = 10;
const BAD = ["SHIT", "FUCK", "CUNT", "DICK", "COCK", "PISS", "SLUT", "WHORE", "RAPE", "NAZI", "DAMN", "HELL", "KILL", "DEAD", "DRUG", "SEXY", "ANAL", "PORN", "NUDE"];
const words = readFileSync(join(here, "words.txt"), "utf8")
  .split("\n").map((w) => w.trim().toUpperCase())
  .filter((w) => /^[A-Z]{4,8}$/.test(w) && w !== [...w].reverse().join(""));
const DIRS = [[0, 1], [1, 0], [1, 1]]; // right, down, diagonal down-right

function lines(grid) { // every line of the grid in all 8 directions, as strings
  const out = [];
  const dirs8 = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs8) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const pr = r - dr, pc = c - dc;
      if (pr >= 0 && pr < N && pc >= 0 && pc < N) continue; // not a line start
      let s = "";
      for (let rr = r, cc = c; rr >= 0 && rr < N && cc >= 0 && cc < N; rr += dr, cc += dc) s += grid[rr * N + cc];
      out.push(s);
    }
  }
  return out.flatMap((s) => [s, [...s].reverse().join("")]);
}
const occurrences = (hay, needle) => { let n = 0; for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) n++; return n; };

function build() {
  const chosen = [];
  while (chosen.length < 8) { const w = words[pick(words.length)]; if (!chosen.includes(w)) chosen.push(w); }
  const order = [...chosen].sort((a, b) => b.length - a.length);
  const grid = Array(N * N).fill("");
  const place = {};
  for (const w of order) {
    let ok = false;
    for (let t = 0; t < 300 && !ok; t++) {
      const [dr, dc] = DIRS[pick(3)];
      const r = pick(N), c = pick(N);
      const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
      if (er >= N || ec >= N) continue;
      let fits = true;
      for (let i = 0; i < w.length; i++) { const g = grid[(r + dr * i) * N + c + dc * i]; if (g && g !== w[i]) { fits = false; break; } }
      if (!fits) continue;
      for (let i = 0; i < w.length; i++) grid[(r + dr * i) * N + c + dc * i] = w[i];
      place[w] = [r * N + c, er * N + ec];
      ok = true;
    }
    if (!ok) return null;
  }
  const base = [...grid];
  for (let attempt = 0; attempt < 40; attempt++) {
    const g = base.map((x) => x || String.fromCharCode(65 + pick(26)));
    const all = lines(g);
    const joined = all.join("|");
    if (!chosen.every((w) => occurrences(joined, w) === 1)) continue; // exactly one place, in any direction
    if (BAD.some((b) => joined.includes(b))) continue;
    return { grid: g.join(""), chosen, place };
  }
  return null;
}

const seen = new Set();
const rows = [];
while (rows.length < count) {
  const p = build();
  if (!p || seen.has(p.grid)) continue;
  seen.add(p.grid);
  const ws = p.chosen;
  rows.push([p.grid, ws.join(","), ws.map((w) => p.place[w][0]).join(","), ws.map((w) => p.place[w][1]).join(",")].join("\t"));
}
process.stdout.write(rows.join("\n") + "\n");
