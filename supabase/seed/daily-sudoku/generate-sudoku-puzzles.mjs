// Generates Number Nook (daily sudoku) puzzles from scratch: a random full grid, then cells are removed
// while the puzzle keeps exactly ONE solution. "Easy" puzzles must also be solvable with the two simplest
// techniques only (a cell with one possible number; a number that fits one place in a row/column/box), and
// keep 40 to 46 given numbers. Medium and Hard are not generated yet (Dani, 27 Nov: easy for now).
//   node generate-sudoku-puzzles.mjs [count] [seed] > puzzles.tsv     (columns: difficulty, puzzle, solution)
const COUNT = Number(process.argv[2] ?? 400);
let seed = Number(process.argv[3] ?? 20261127) >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const PEERS = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9, s = new Set();
  for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) s.add((br + y) * 9 + bc + x);
  s.delete(i); return [...s];
});
const UNITS = [];
for (let i = 0; i < 9; i++) {
  UNITS.push(Array.from({ length: 9 }, (_, k) => i * 9 + k), Array.from({ length: 9 }, (_, k) => k * 9 + i));
  const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3;
  UNITS.push(Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3)));
}

// Count solutions (stop at `limit`), always branching on the cell with fewest candidates.
function countSolutions(g, limit) {
  let n = 0;
  const cand = (i) => { let m = 0x3fe; for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]); return m; };
  const rec = () => {
    let best = -1, bm = 0, bc = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = cand(i); let c = 0; for (let b = m; b; b &= b - 1) c++;
      if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; }
    }
    if (best < 0) { n++; return n >= limit; }
    if (bc === 0) return false;
    for (let d = 1; d <= 9; d++) if (bm & (1 << d)) { g[best] = d; if (rec()) { g[best] = 0; return true; } }
    g[best] = 0; return false;
  };
  rec(); return n;
}

function randomSolution() {
  const g = new Array(81).fill(0);
  const rec = (i) => {
    if (i === 81) return true;
    const used = new Set(PEERS[i].map((p) => g[p]));
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (!used.has(d)) { g[i] = d; if (rec(i + 1)) return true; }
    g[i] = 0; return false;
  };
  rec(0); return g;
}

// Solvable with singles only? (naked single: one candidate; hidden single: one place in a unit)
function singlesOnly(puz) {
  const g = [...puz];
  const cands = () => g.map((v, i) => { if (v) return 0; let m = 0x3fe; for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]); return m; });
  for (;;) {
    let progress = false;
    const cm = cands();
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = cm[i]; if (m && (m & (m - 1)) === 0) { g[i] = Math.log2(m); progress = true; }
    }
    if (progress) continue;
    for (const u of UNITS) for (let d = 1; d <= 9; d++) {
      const spots = u.filter((i) => !g[i] && (cm[i] & (1 << d)));
      if (spots.length === 1 && !u.some((i) => g[i] === d)) { g[spots[0]] = d; progress = true; break; }
    }
    if (!progress) break;
  }
  return g.every((v) => v);
}

const out = new Set(), rows = [];
let tries = 0;
while (rows.length < COUNT && tries < COUNT * 400) {
  tries++;
  const sol = randomSolution();
  const puz = [...sol];
  const target = 40 + Math.floor(rand() * 7); // 40..46 given numbers
  let given = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (given <= target) break;
    const keep = puz[i]; puz[i] = 0;
    if (countSolutions([...puz], 2) !== 1) puz[i] = keep; else given--;
  }
  if (given > 46 || !singlesOnly(puz)) continue;
  const p = puz.join(""); if (out.has(p)) continue; out.add(p);
  rows.push(["easy", p, sol.join("")]);
}
if (rows.length < COUNT) { console.error(`Only found ${rows.length} of ${COUNT}`); process.exit(1); }
console.log(rows.map((r) => r.join("\t")).join("\n"));
