// Fit the belief map's weights (app/src/belief.js) and score them honestly.
// Labels: the current hidden-rock layer rocks_fine (Jules's R3 version: HiRISE DTM estimate + 23 reviewed rocks).
// Fit on the west half, score on the east half, and separately on Jules's 22 human-reviewed rock cells
// (ml/exports/rocks.json), the only labels not made from orbit data. Writes app/src/belief-weights.js and
// app/scripts/belief-fit.json. Rerun when rocks_fine changes (for example, the whole-slice ROSCO export).
// Run: node app/scripts/belief-fit.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseLayer } from '../src/world.js'
import { featureColumns, beliefMap } from '../src/belief.js'

const dir = new URL('../../data/worlds/gale/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
const W = meta.width, N = W * meta.height
const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
  .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, N)]))
const world = { meta, layers }
const rocks = layers.rocks_fine
const cols = featureColumns(world)
const rocksHash = createHash('sha256').update(readFileSync(new URL('rocks_fine.u8', dir))).digest('hex').slice(0, 16)

const walkable = [...Array(N).keys()].filter((i) => layers.slope[i] <= meta.knobs.max_slope_deg)
const west = walkable.filter((i) => i % W < W / 2), east = walkable.filter((i) => i % W >= W / 2)
const reviewed = new Set(JSON.parse(readFileSync(new URL('../../ml/exports/rocks.json', import.meta.url)))
  .accepted_points.map((a) => a.cell[1] * W + a.cell[0]))
const reviewedIdx = walkable.filter((i) => reviewed.has(i) || !rocks[i])

function auc(score, idx, label) {
  const s = idx.map((i) => [score[i], label(i)]).sort((a, b) => a[0] - b[0])
  let pos = 0, neg = 0, rank = 0
  for (let k = 0; k < s.length;) {
    let j = k
    while (j < s.length && s[j][0] === s[k][0]) j++
    const r = (k + j + 1) / 2
    for (let m = k; m < j; m++) if (s[m][1]) { rank += r; pos++ } else neg++
    k = j
  }
  return +((rank - pos * (pos + 1) / 2) / (pos * neg)).toFixed(3)
}

// ponytail: plain logistic regression by gradient descent with a small L2 penalty; enough for 2-4 features.
function fit(features) {
  const mean = features.map((f) => west.reduce((a, i) => a + cols[f][i], 0) / west.length)
  const sd = features.map((f, k) => Math.sqrt(west.reduce((a, i) => a + (cols[f][i] - mean[k]) ** 2, 0) / west.length) || 1)
  const rate = west.reduce((a, i) => a + rocks[i], 0) / west.length
  const wts = { features, mean, sd, bias: Math.log(rate / (1 - rate)), w: features.map(() => 0) }
  for (let it = 0; it < 400; it++) {
    const g = new Float64Array(features.length + 1)
    for (const i of west) {
      let z = wts.bias
      features.forEach((f, k) => (z += wts.w[k] * (cols[f][i] - mean[k]) / sd[k]))
      const e = 1 / (1 + Math.exp(-z)) - rocks[i]
      g[0] += e
      features.forEach((f, k) => (g[k + 1] += e * (cols[f][i] - mean[k]) / sd[k]))
    }
    wts.bias -= (1.0 * g[0]) / west.length
    features.forEach((_, k) => (wts.w[k] -= 1.0 * (g[k + 1] / west.length + 1e-3 * wts.w[k])))
  }
  const p = beliefMap(world, null, null, wts, cols)
  const eastRate = east.reduce((a, i) => a + rocks[i], 0) / east.length
  const eastMean = east.reduce((a, i) => a + p[i], 0) / east.length
  return {
    weights: { ...wts, w: wts.w.map((v) => +v.toFixed(4)), bias: +wts.bias.toFixed(4), mean: mean.map((v) => +v.toFixed(5)), sd: sd.map((v) => +v.toFixed(5)) },
    auc_east_vs_rock_layer: auc(p, east, (i) => rocks[i]),
    auc_vs_reviewed_rocks: auc(p, reviewedIdx, (i) => reviewed.has(i)),
    east_rock_rate: +eastRate.toFixed(4), east_mean_predicted: +eastMean.toFixed(4),
  }
}

const candidates = [
  ['slope_ratio', 'relief_8m', 'unsure', 'thermal_inertia'],
  ['slope_ratio', 'relief_8m', 'thermal_inertia'],
  ['slope_ratio', 'relief_8m'],
  ['unsure'],
].map(fit)
// Choose by the independent labels (reviewed rocks), not by the layer the model was fitted on.
const best = candidates.reduce((a, b) => (b.auc_vs_reviewed_rocks > a.auc_vs_reviewed_rocks ? b : a))
const out = { labels: `rocks_fine.u8 sha256:${rocksHash} (R3: DTM estimate + 23 reviewed rocks)`, reviewed_rock_cells: reviewed.size,
  chosen: best.weights.features, candidates }
writeFileSync(new URL('belief-fit.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
writeFileSync(new URL('../src/belief-weights.js', import.meta.url),
  `// Written by app/scripts/belief-fit.mjs from ${out.labels}. Do not edit by hand.\nexport default ${JSON.stringify(best.weights)}\n`)
console.log(JSON.stringify(out, null, 1))
