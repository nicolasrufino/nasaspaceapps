// Belief map v1 (docs/SCOUT-ALGORITHM.md §2A, step 1 of the scouting algorithm): for every cell, the chance it hides
// rocks that block a suited walker, predicted from orbit layers only. Cells the helicopter has seen become certain.
// The weights come from app/scripts/belief-fit.mjs, fitted on the current hidden-rock layer (Jules's R3 version of
// rocks_fine) and scored on his human-reviewed rocks. Swap point: when the whole-slice ROSCO export replaces
// rocks_fine, rerun that script; this file does not change.
import WEIGHTS from './belief-weights.js'

// Orbit features, one value per cell. Not used: fine_steep, dropoff, terrain_class. They come from the same 1 m
// roughness that built the rock estimate, so they would predict it by construction (docs/SCOUT-ALGORITHM.md §2A).
export function featureColumns({ meta, layers }) {
  const W = meta.width, H = meta.height, N = W * H
  const relief = new Float32Array(N) // spread of 8 m heights in the 3x3 around the cell
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i - x) / W
    let s = 0, s2 = 0, n = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
      const v = layers.height[yy * W + xx]
      s += v; s2 += v * v; n++
    }
    relief[i] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2))
  }
  const zero = new Float32Array(N)
  return {
    slope_ratio: layers.slope.map((s) => s / meta.knobs.max_slope_deg),
    relief_8m: relief,
    unsure: layers.unsure ?? zero, // Luca's share of crossings close to a limit (#93)
    thermal_inertia: layers.thermal_inertia ?? zero, // THEMIS, 100 m
  }
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z))

// Chance of blocking rocks per cell (0-1). Seen cells are 0 or 1: what the helicopter found.
export function beliefMap(world, scanned, blocked, weights = WEIGHTS, cols = featureColumns(world)) {
  const N = world.meta.width * world.meta.height
  const p = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    if (scanned?.[i]) { p[i] = blocked?.[i] ? 1 : 0; continue }
    let z = weights.bias
    weights.features.forEach((f, k) => (z += weights.w[k] * (cols[f][i] - weights.mean[k]) / weights.sd[k]))
    p[i] = sigmoid(z)
  }
  return p
}
