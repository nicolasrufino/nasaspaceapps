// Whole-area helicopter survey (SkyFall-style fleet; JPL lists three helicopters, launch 2028).
// The flight is simulated. It answers two questions before anyone picks stops:
//   1. Hardware: with N helicopters, how many flights and sols to map the slice (reachable part first)?
//   2. Where to go: a "best areas" score per cell from what is known so far.
import { FLIGHT_M, SWATH_M, scanAt } from './scout.js'
import { costFrom } from './plan.js'

export const FLIGHTS_PER_SOL = 1 // ponytail: estimate (solar recharge); Ingenuity flew far less often. A knob, not a fact.

// Back-and-forth strips over the whole slice, cut into flights of at most FLIGHT_M.
// Strip spacing makes neighbouring swaths touch, so no cell is missed.
// Order: flights that see round-trip-reachable ground first, nearest base first; then the rest.
export function surveyPlan(meta, ctg, { helicopters = 3, flightsPerSol = FLIGHTS_PER_SOL } = {}) {
  const { width: W, height: H, cell_size_m: cs } = meta
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const r = Math.floor(SWATH_M / cs) // rows each side a pass sees
  const step = 2 * r + 1
  const seg = Math.max(1, Math.floor(FLIGHT_M / cs)) // cells per flight along a strip (seg-1 steps <= FLIGHT_M)
  const [bx, by] = meta.base_cell
  const flights = []
  for (let y = r, row = 0; y < H + r; y += step, row++) {
    const yc = Math.min(y, H - 1)
    for (let x0 = 0; x0 < W; x0 += seg) {
      const x1 = Math.min(W - 1, x0 + seg - 1)
      let reach = 0
      for (let yy = Math.max(0, yc - r); yy <= Math.min(H - 1, yc + r); yy++)
        for (let x = x0; x <= x1; x++) if (ctg[yy * W + x] <= usable / 2) reach++
      flights.push({
        waypoints: row % 2 ? [[x1, yc], [x0, yc]] : [[x0, yc], [x1, yc]],
        metres: (x1 - x0) * cs,
        reachable: reach > 0,
        far: Math.hypot((x0 + x1) / 2 - bx, yc - by),
      })
    }
  }
  flights.sort((a, b) => b.reachable - a.reachable || a.far - b.far)
  const perSol = helicopters * flightsPerSol
  flights.forEach((f, k) => {
    f.heli = k % helicopters
    f.sol = Math.floor(k / perSol) + 1
  })
  const lastReach = flights.findLastIndex((f) => f.reachable)
  return {
    flights,
    sols: flights.at(-1)?.sol ?? 0,
    solsReachable: lastReach < 0 ? 0 : flights[lastReach].sol,
    km: flights.reduce((m, f) => m + f.metres, 0) / 1000,
  }
}

// Scan every cell the swath passes between two points (cell units), so fast playback leaves no gaps.
export function scanSegment(meta, scanned, [ax, ay], [bx, by]) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2))
  const fresh = []
  for (let k = 0; k <= n; k++) fresh.push(...scanAt(meta, scanned, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n))
  return fresh
}

// "Best areas" score, 0 (don't) to 1 (go), from what is known now:
// - 0 if too steep, a rock the helicopter saw, or the round trip from base doesn't fit the usable energy;
// - otherwise the share of usable energy left after the round trip, halved where nobody has scouted yet,
//   and weighted by science value (science.u8, CRISM / geologic map) when the world has it.
export function bestAreas({ meta, layers }, ctg, scanned, blocked) {
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const out = costFrom({ meta, layers }, meta.base_cell, blocked).dist // base -> cell; ctg is cell -> base
  const score = new Float32Array(meta.width * meta.height)
  for (let i = 0; i < score.length; i++) {
    if (layers.slope[i] > meta.knobs.max_slope_deg || blocked?.[i]) continue
    const left = 1 - (out[i] + ctg[i]) / usable
    if (!(left > 0)) continue
    const sci = layers.science ? 0.4 + 0.2 * layers.science[i] : 1
    score[i] = left * (scanned[i] ? 1 : 0.5) * sci
  }
  return score
}
