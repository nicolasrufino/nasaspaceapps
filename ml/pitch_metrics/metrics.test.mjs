import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepCost } from '../../app/src/walk.js'
import { costFrom } from '../../app/src/plan.js'
import { aboveFraction, marginSummary, routeProfile, ringStats, knownReturnCosts, hazardContacts, simulateScout } from './metrics.mjs'
import { buildReport, loadInputs } from './run.mjs'

function fixture() {
  const meta = { width: 4, height: 4, cell_size_m: 8, base_cell: [0, 0], energy_budget_j: 100000,
    reserve_fraction: .2, gravity_mps2: 3.71,
    knobs: { body_kg: 75, load_kg: 60, speed_mps: 1, max_slope_deg: 25 } }
  const layers = { height: new Float32Array(16), slope: new Float32Array(16), terrain_class: new Uint8Array(16).fill(1),
    rocks_fine: new Uint8Array(16), cost_to_go: new Float32Array(16).fill(100), cost_to_go_scouted: new Float32Array(16).fill(120) }
  return { meta, layers }
}

test('return audit reverses uphill/downhill energy and respects blocked vertices', () => {
  const world = fixture()
  world.layers.height[1] = 10
  const toBase = knownReturnCosts(world, null)
  const forward = costFrom(world, [1, 0]).dist[0]
  assert.ok(Math.abs(toBase[1] - forward) < 1e-8)
  assert.ok(toBase[1] < stepCost(world.meta, world.layers.height, world.layers.terrain_class, [0, 0], [1, 0]))
  const blocked = new Uint8Array(16)
  blocked[1] = 1
  assert.equal(knownReturnCosts(world, blocked)[1], Infinity)
  assert.equal(toBase[0], 0)
})

test('energy uncertainty scales spent energy AND return cost without scaling reserve', () => {
  const world = fixture()
  const costs = new Float64Array(16).fill(1000)
  const route = [[0, 0], [1, 0]]
  const normal = routeProfile(world, route, costs)
  const stress = routeProfile(world, route, costs, 1.3)
  const spent = normal[1].nominal_spent_j
  assert.equal(stress[1].margin_after_reserve_j, 100000 - 1.3 * spent - 1300 - 20000)
  assert.equal(stress[1].return_j, 1300)
  assert.equal(stress[1].energy_left_j, 100000 - 1.3 * spent)
  assert.throws(() => routeProfile(world, route, costs, 0), /Invalid/)
})

test('return audit follows homebound crossings, including one-way links', () => {
  const world = fixture()
  world.layers.passable = new Uint8Array(16)
  world.layers.passable[1] = 1 << 3 // west from [1, 0] to base, no eastbound link
  const home = knownReturnCosts(world, null)
  assert.equal(home[1], stepCost(world.meta, world.layers.height, world.layers.terrain_class, [1, 0], [0, 0]))
  assert.equal(home[2], Infinity)
  assert.equal(costFrom(world, [0, 0]).dist[1], Infinity)
  assert.equal(world.layers.passable[0], 0)
})

test('twenty-percent share is distance weighted with threshold interpolation', () => {
  const profile = [
    { distance_m: 0, margin_after_reserve_j: 30, cell: [0, 0] },
    { distance_m: 1, margin_after_reserve_j: 30, cell: [1, 0] },
    { distance_m: 100, margin_after_reserve_j: 10, cell: [2, 0], energy_left_j: 40 }]
  const summary = marginSummary(profile, 100)
  assert.equal(summary.distance_with_extra_20pct_margin_m, 50.5)
  assert.equal(summary.fraction_distance_with_extra_20pct_margin, .505)
  assert.equal(summary.fraction_distance_return_and_reserve_feasible, 1)
  assert.equal(aboveFraction(10, 30, 20), .5)
  assert.equal(aboveFraction(20, 20, 20), 1)
  assert.equal(aboveFraction(Infinity, 30, 20), 0)
})

test('ring area uses cells and excludes sentinels; higher cost removes cells', () => {
  const meta = { energy_budget_j: 1000, reserve_fraction: .2, cell_size_m: 8 }
  const costs = [0, 100, 500, 600, 700, 3e38, Infinity]
  const nominal = ringStats(meta, costs, 200)
  const high = ringStats(meta, costs, 200, 1.3)
  const low = ringStats(meta, costs, 200, .7)
  assert.equal(nominal.cells, 4)
  assert.equal(nominal.area_m2, 4 * 64)
  assert.equal(high.cells, 2)
  assert.equal(high.lost_cells, 2)
  assert.equal(high.change_percent_vs_nominal, -50)
  assert.equal(low.cells, 5)
  assert.equal(low.gained_cells, 1)
})

test('hazard visits do not become individual-rock or unique-cell counts', () => {
  const world = fixture()
  world.layers.rocks_fine[1] = 1
  const result = hazardContacts(world.meta, [[0, 0], [1, 0], [1, 0]], world.layers.rocks_fine)
  assert.equal(result.unique_cells, 1)
  assert.equal(result.cell_visits, 2)
  assert.deepEqual(result.cells, [[1, 0]])
})

test('scout preserves accumulated observations without mutating inputs or leaking distant hazards', () => {
  const world = fixture()
  world.layers.rocks_fine[15] = 1
  const targets = [{ id: 'near', cell: [1, 0] }]
  const first = simulateScout(world, targets, '60fps')
  assert.equal(first.blocked[15], 0)
  assert.equal(first.discovered_hazard_cells, 0)
  const old = new Uint8Array(16)
  old[15] = 1
  const again = simulateScout(world, targets, '60fps', old)
  assert.equal(again.blocked[15], 1)
  assert.equal(again.newly_discovered_hazard_cells, 0)
  assert.equal(old.reduce((a, b) => a + b, 0), 1)
  assert.ok(world.layers.cost_to_go.every((v) => v === 100))
})

test('Gale report separates observed hazards, hidden hazards, model accuracy and final convergence', () => {
  const report = buildReport()
  const r = report.results
  const { world } = loadInputs()
  assert.equal(report.scenario.energy_scenario, world.meta.default_scenario)
  assert.equal(report.scenario.energy_budget_j, world.meta.scenarios[world.meta.default_scenario].energy_budget_j)
  assert.ok(report.source_sha256['data/worlds/gale/passable.u8'])
  // Same selected stops: avoid claiming a lower cost by silently dropping science.
  assert.deepEqual(new Set(r.orbit_only.stops), new Set(r.after_scout.stops))
  assert.deepEqual(new Set(r.orbit_only.stops), new Set(r.repeated_scout.final_route.stops))
  assert.equal(r.after_scout.discovered_hazards.unique_cells, 0)
  assert.equal(r.after_scout.all_layer_hazards.unique_cells, 0)
  assert.equal(r.scout.flights, 3)
  assert.equal(r.repeated_scout.total_flights, 3)
  assert.ok(r.repeated_scout.passes.every((p) => p.flights === 1 && p.flight_metres <= 1000))
  assert.ok(r.repeated_scout.passes[0].new_route_all_layer_hazard_cells > 0, 'Must re-plan and scout again')
  for (const sample of r.sampling_sensitivity) {
    assert.equal(sample.after_energy_j, r.after_scout.energy_j)
    assert.equal(sample.scanned_cells, r.scout.scanned_cells)
    assert.equal(sample.discovered_hazard_cells, r.scout.discovered_hazard_cells)
  }
  assert.ok(r.repeated_scout.converged)
  assert.equal(r.repeated_scout.final_route.all_layer_hazards.unique_cells, 0)
  assert.equal(r.repeated_scout.passes.at(-1).new_route_fully_scanned, true)
  const route = r.repeated_scout.final_route.cells
  assert.deepEqual(route[0], world.meta.base_cell)
  assert.deepEqual(route.at(-1), world.meta.base_cell)
  for (let k = 1; k < route.length; k++) {
    const [a, b] = [route[k - 1], route[k]]
    assert.equal(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), 1)
    assert.equal(world.layers.rocks_fine[b[1] * world.meta.width + b[0]], 0)
  }
  const margins = r.repeated_scout.energy_sensitivity.map((s) => s.margin.minimum_margin_after_reserve_j)
  assert.ok(margins[0] > margins[1] && margins[1] > margins[2] && margins[2] > 0)
  assert.equal(report.vision_evidence.rocks.precision, null)
  assert.equal(report.vision_evidence.rocks.recall, null)
  assert.equal(report.vision_evidence.terrain.curiosity.support_by_class[4], 0)
  assert.equal(report.vision_evidence.terrain.used_for_this_route, false)
  assert.equal(report.vision_evidence.buddy.placeholder, true)
  assert.ok(report.vision_evidence.terrain.perseverance.accuracy < report.vision_evidence.terrain.curiosity.accuracy)
})
