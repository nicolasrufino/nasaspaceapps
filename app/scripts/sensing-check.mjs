// Feasibility check for "sensing" (docs/SCOUT-ALGORITHM.md §2A): can orbit-scale features predict
// which cells hide blockers? Label = rocks_fine (Gale: rough in the 1 m HiRISE DTM but gentle at 8 m).
// Features = only what the 8 m map and THEMIS give, never the 1 m roughness the label is made from.
// Trained on the west half, scored on the east half (a spatial split, so neighbours don't leak).
// Run: node app/scripts/sensing-check.mjs  → prints a summary and writes app/scripts/sensing-check.json
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLayer } from '../src/world.js'

const dir = new URL('../../data/worlds/gale/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
const W = meta.width, N = W * meta.height
const L = (k) => parseLayer(meta.files[k], new Uint8Array(readFileSync(new URL(meta.files[k], dir))).buffer, N)
const [h, slope, ti, rocks] = ['height', 'slope', 'thermal_inertia', 'rocks_fine'].map(L)

// 3x3 relief at 8 m: spread of heights around the cell (what orbit at 8 m sees of bumpiness).
const relief = new Float32Array(N)
for (let i = 0; i < N; i++) {
  const x = i % W, y = (i - x) / W
  let s = 0, s2 = 0, n = 0
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy
    if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue
    const v = h[yy * W + xx]; s += v; s2 += v * v; n++
  }
  relief[i] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2))
}

const feats = { slope_8m: slope, relief_8m: relief, thermal_inertia: ti }
const names = Object.keys(feats)
// Cells a walker could enter at all (the label is only defined there: slope under the wall limit).
const cells = [...Array(N).keys()].filter((i) => slope[i] <= meta.knobs.max_slope_deg)
const west = cells.filter((i) => i % W < W / 2), east = cells.filter((i) => i % W >= W / 2)

// AUC: chance a random rock cell scores higher than a random clear cell (0.5 = no signal).
const auc = (score, idx) => auc2(score, idx, (i) => rocks[i])
function auc2(score, idx, label) {
  const s = idx.map((i) => [score(i), label(i)]).sort((a, b) => a[0] - b[0])
  let pos = 0, neg = 0, rank = 0
  for (let k = 0; k < s.length;) {
    let j = k
    while (j < s.length && s[j][0] === s[k][0]) j++
    const r = (k + j + 1) / 2 // average rank for ties
    for (let m = k; m < j; m++) if (s[m][1]) { rank += r; pos++ } else neg++
    k = j
  }
  return pos && neg ? (rank - pos * (pos + 1) / 2) / (pos * neg) : NaN
}

// ponytail: plain logistic regression by gradient descent; a tree model or CNN is the upgrade if this shows signal.
const mean = names.map((f) => west.reduce((a, i) => a + feats[f][i], 0) / west.length)
const sd = names.map((f, k) => Math.sqrt(west.reduce((a, i) => a + (feats[f][i] - mean[k]) ** 2, 0) / west.length) || 1)
const z = (i) => names.map((f, k) => (feats[f][i] - mean[k]) / sd[k])
const w = new Float64Array(names.length + 1)
const p = (i) => { const x = z(i); let t = w[0]; x.forEach((v, k) => (t += w[k + 1] * v)); return 1 / (1 + Math.exp(-t)) }
for (let it = 0; it < 300; it++) {
  const g = new Float64Array(w.length)
  for (const i of west) { const e = p(i) - rocks[i]; g[0] += e; z(i).forEach((v, k) => (g[k + 1] += e * v)) }
  w.forEach((_, k) => (w[k] -= (0.5 * g[k]) / west.length))
}

const rate = (idx) => idx.reduce((a, i) => a + rocks[i], 0) / idx.length
// How much a 20% flight budget catches if aimed at the highest predicted risk vs at random.
const top = [...east].sort((a, b) => p(b) - p(a)).slice(0, Math.round(east.length * 0.2))
const caught = top.reduce((a, i) => a + rocks[i], 0) / east.reduce((a, i) => a + rocks[i], 0)

// Jules's human-reviewed ROSCO rocks (ml/exports/rocks.json, R3): the only cells that are not a DTM rule.
// Scored apart: reviewed cells vs cells with no hazard at all, over the whole slice (too few to split).
let reviewed = null
try {
  const r = JSON.parse(readFileSync(new URL('../../ml/exports/rocks.json', import.meta.url)))
  const own = new Set(r.accepted_points.map((a) => a.cell[1] * W + a.cell[0]))
  const pad = new Set(r.accepted_points.flatMap((a) => a.clearance_cells.map(([x, y]) => y * W + x)))
  const idx = cells.filter((i) => own.has(i) || !rocks[i])
  const lab = (i) => own.has(i) ? 1 : 0
  const aucOn = (score) => auc2(score, idx, lab)
  reviewed = { rock_cells: own.size, padded_cells: pad.size,
    auc_per_feature: Object.fromEntries(names.map((f) => [f, aucOn((i) => feats[f][i])])), auc_combined: aucOn(p) }
} catch { /* no R3 export in this checkout */ }

const out = {
  label: 'rocks_fine (Gale estimate from the 1 m HiRISE DTM; not ground truth)',
  cells_walkable: cells.length, rock_rate_west: rate(west), rock_rate_east: rate(east),
  auc_east_per_feature: Object.fromEntries(names.map((f) => [f, auc((i) => feats[f][i], east)])),
  auc_east_combined: auc(p, east),
  rocks_caught_by_top_20pct_east: caught,
  reviewed_rocks_R3: reviewed,
  weights: Object.fromEntries([['bias', w[0]], ...names.map((f, k) => [f, w[k + 1]])]),
}
writeFileSync(new URL('sensing-check.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(out)
