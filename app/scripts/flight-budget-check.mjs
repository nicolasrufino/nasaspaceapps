// Test the flight-budget recommendation (docs/DECISION-BRIEFS.md §7) with arithmetic and on the real Gale world.
// Inputs, each cited:
//   SkyFall: "~1-2 km per flight sol (approximately 2.5 min of flight time), alternating with one non-flight sol to
//     recharge" -- NASA SkyFall Mission Information Package, Sept 2026, §II.
//   Ingenuity: longest flight 704 m and 169.5 s; top ground speed 10 m/s (Flights 62, 68, 69) -- NASA/JPL flight log
//     (docs/RESEARCH.md §14; science.nasa.gov "Flight 62 preview by the numbers").
// Run: node app/scripts/flight-budget-check.mjs  -> prints and writes app/scripts/flight-budget-check.json
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLayer } from '../src/world.js'
import { planTour, costFrom, pathCells } from '../src/plan.js'
import { scanAt, pointAlong, SWATH_M } from '../src/scout.js'

const SKYFALL_FLIGHT_S = 150, INGENUITY_TOP_MPS = 10, INGENUITY_LONGEST_M = 704, INGENUITY_LONGEST_S = 169.5

// 1. Speed check: the average speed each per-flight distance needs in a 2.5 min flight.
const speed = Object.fromEntries([700, 1000, 1500, 2000].map((d) => [d, +(d / SKYFALL_FLIGHT_S).toFixed(2)]))
const ingenuityBestAverage = +(INGENUITY_LONGEST_M / INGENUITY_LONGEST_S).toFixed(2)

// 2. The real Gale world, with the app's own planner (walk-scale crossings, 20° limit, suit budget).
const dir = new URL('../../data/worlds/gale/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
const N = meta.width * meta.height
const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
  .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, N)]))
const world = { meta, layers }
const targets = JSON.parse(readFileSync(new URL('targets.json', dir)))
const route = planTour(world, targets)
const len = (cells) => cells.reduce((m, c, k) => (k ? m + meta.cell_size_m * Math.hypot(c[0] - cells[k - 1][0], c[1] - cells[k - 1][1]) : 0), 0)
const [bx, by] = meta.base_cell
const farthest = Math.max(...route.cells.map(([x, y]) => meta.cell_size_m * Math.hypot(x - bx, y - by)))

// Three candidate corridors base -> farthest stop: cheapest, then cells already used made 1.9x costlier (brief §2B).
const far = targets.map((t) => t.cell).sort((a, b) => Math.hypot(b[0] - bx, b[1] - by) - Math.hypot(a[0] - bx, a[1] - by))[0]
const W = meta.width, used = new Float32Array(N).fill(1), corridors = []
for (let k = 0; k < 3; k++) {
  const { prev } = costFrom(world, meta.base_cell, null, (m, l, i, j) => {
    const d = m.cell_size_m * Math.hypot((i % W) - (j % W), Math.floor(i / W) - Math.floor(j / W))
    return d * used[j]
  })
  const p = pathCells(prev, W, far[1] * W + far[0])
  corridors.push(p)
  p.forEach(([x, y]) => (used[y * W + x] *= 1.9))
}

// 3. How much of the planned route's corridor N flights of D metres see, flying along the route from base
//    (route-only scouting, the published baseline), and how many of the route's hazard cells they reveal.
function coverage(flights, D) {
  const onRoute = new Set(), seen = new Uint8Array(N)
  const routeScan = new Uint8Array(N)
  for (let a = 0; a <= len(route.cells); a += 2) { const p = pointAlong(meta, route.cells, a); if (p) scanAt(meta, routeScan, p[0], p[1]) }
  routeScan.forEach((v, i) => v && onRoute.add(i))
  const budget = Math.min(flights * D, len(route.cells))
  for (let a = 0; a <= budget; a += 2) { const p = pointAlong(meta, route.cells, a); if (p) scanAt(meta, seen, p[0], p[1]) }
  let corridorSeen = 0, hazards = 0, hazardsSeen = 0
  for (const i of onRoute) { corridorSeen += seen[i]; if (layers.rocks_fine[i]) { hazards++; hazardsSeen += seen[i] } }
  return { flights, metres_each: D, route_corridor_seen_pct: +(100 * corridorSeen / onRoute.size).toFixed(1), hazard_cells_near_route: hazards, hazard_cells_seen: hazardsSeen }
}
// 4. The real loop: fly the next unseen stretch of the current route, re-plan around what was found, repeat.
//    Route-only scouting (the published baseline; our value-of-information planner is not built yet).
//    ponytail: each flight covers D metres along the route from its first unseen point (SkyFall-style, resting in the
//    field between flights); transit from the habitat is not charged. All Gale stops lie within 354 m of base.
const allRocks = layers.rocks_fine
const oracle = planTour(world, targets, allRocks)
function loop(flights, D) {
  const seen = new Uint8Array(N), blocked = new Uint8Array(N)
  let used = 0
  for (; used < flights; used++) {
    const r = planTour(world, targets, blocked)
    const total = len(r.cells)
    let start = -1
    for (let a = 0; a <= total; a += 2) { const p = pointAlong(meta, r.cells, a); if (p && !seen[Math.round(p[1]) * W + Math.round(p[0])]) { start = a; break } }
    if (start < 0) break // whole current route already seen
    for (let a = start; a <= Math.min(total, start + D); a += 2) { const p = pointAlong(meta, r.cells, a); if (p) scanAt(meta, seen, p[0], p[1]) }
    seen.forEach((v, i) => v && allRocks[i] && (blocked[i] = 1))
  }
  const final = planTour(world, targets, blocked)
  const unseenHazardsOnRoute = final.cells.filter(([x, y]) => allRocks[y * W + x] && !seen[y * W + x]).length
  return { flights_budget: flights, metres_each: D, flights_used: used,
    unseen_hazard_cells_on_final_route: unseenHazardsOnRoute,
    energy_kj: +(final.energy_j / 1000).toFixed(1), extra_vs_knowing_all_pct: +(100 * (final.energy_j / oracle.energy_j - 1)).toFixed(1) }
}
const loopResults = [[3, 700], [3, 1000], [3, 1500], [6, 700], [6, 1000], [6, 1500], [12, 1000]].map(([f, d]) => loop(f, d))

const flightsToCoverRoute = Object.fromEntries([700, 1000, 1500, 2000].map((d) => [d, Math.ceil(len(route.cells) / d)]))

const out = {
  inputs: { skyfall_flight_s: SKYFALL_FLIGHT_S, ingenuity_top_mps: INGENUITY_TOP_MPS, ingenuity_longest_m: INGENUITY_LONGEST_M, ingenuity_longest_s: INGENUITY_LONGEST_S, swath_radius_m: SWATH_M },
  average_speed_needed_mps: speed, ingenuity_best_average_mps: ingenuityBestAverage,
  gale: {
    slope_limit_deg: meta.knobs.max_slope_deg, stops: route.stops.length, dropped: route.dropped,
    route_m: Math.round(len(route.cells)), route_energy_kj: +(route.energy_j / 1000).toFixed(1),
    farthest_point_from_base_m: Math.round(farthest),
    candidate_corridors_m: corridors.map((c) => Math.round(len(c))),
    flights_to_cover_whole_route: flightsToCoverRoute,
  },
  single_pass_route_coverage: [coverage(3, 700), coverage(3, 1000)],
  knowing_all_rocks: { energy_kj: +(oracle.energy_j / 1000).toFixed(1), unseen_hazard_cells_on_route: 0 },
  no_flights: loop(0, 0),
  fly_and_replan_loop: loopResults,
}
writeFileSync(new URL('flight-budget-check.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify(out, null, 1))
