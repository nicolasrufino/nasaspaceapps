// What changes on Gale if the walking slope limit drops from 25° to 20° (Artemis xEVA suit spec, see PR #94).
// Uses the app's own planner and the current 8 m slope rule (the crossings of PR #93/#94 are not used by the app yet).
// Run: node app/scripts/slope-check.mjs  → prints a summary and writes app/scripts/slope-check.json
import { readFileSync, writeFileSync } from 'node:fs'
import { parseLayer } from '../src/world.js'
import { costFrom, planTour } from '../src/plan.js'

const dir = new URL('../../data/worlds/gale/', import.meta.url)
const meta0 = JSON.parse(readFileSync(new URL('world.json', dir)))
const N = meta0.width * meta0.height
const layers = Object.fromEntries(Object.entries(meta0.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
  .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, N)]))
const targets = JSON.parse(readFileSync(new URL('targets.json', dir)))
const blocked = layers.rocks_fine

const out = {}
for (const limit of [25, 20]) {
  const meta = { ...meta0, knobs: { ...meta0.knobs, max_slope_deg: limit } }
  const world = { meta, layers }
  const walls = layers.slope.reduce((n, s) => n + (s > limit), 0)
  const { dist } = costFrom(world, meta.base_cell, blocked)
  const reachable = dist.reduce((n, d) => n + isFinite(d), 0)
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const halfway = dist.reduce((n, d) => n + (d <= usable / 2), 0) // ponytail: out-leg only; a true round trip needs the reverse search
  const route = planTour(world, targets, blocked)
  const unreachable = targets.filter((t) => !isFinite(dist[t.cell[1] * meta.width + t.cell[0]])).map((t) => t.id)
  out[`limit_${limit}`] = {
    wall_cells_pct: +(100 * walls / N).toFixed(1), reachable_cells_pct: +(100 * reachable / N).toFixed(1),
    out_leg_within_half_usable_pct: +(100 * halfway / N).toFixed(1),
    tour_stops: route.stops.length, tour_dropped: route.dropped, tour_energy_kj: +(route.energy_j / 1000).toFixed(1),
    tour_minutes: +route.minutes.toFixed(1), targets_unreachable: unreachable,
  }
}
const near = layers.slope.reduce((n, s) => n + (s > 15 && s <= 20), 0)
out.cells_15_to_20_deg_pct = +(100 * near / N).toFixed(1) // the new "near the limit" band: where the scout's uncertainty grows
writeFileSync(new URL('slope-check.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(out)
