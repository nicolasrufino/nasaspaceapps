import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeSearch, sampleWorlds, chooseVoi, createVoiContext, execWalk } from '../src/scout-voi.js'
import { costFrom, planTour } from '../src/plan.js'
import { describe } from '../src/why.js'
import { generatedWorld } from '../scripts/voi-worlds.mjs'
import { createScout, launchScoutFlight, completeScoutFlight } from '../src/scout.js'

test('targeted VOI search matches the planner energy and respects directed crossings and known blocks', () => {
  const { world } = generatedWorld(1), { width: W, height: H } = world.meta, N = W * H
  const blocked = new Uint8Array(N); blocked[5 * W + 6] = 1
  const known = Int8Array.from(blocked), p = new Float32Array(N), target = 10 * W + 12
  const search = makeSearch(world), path = search(2 * W + 2, target, known, p)
  const cells = path.map((i) => [i % W, Math.floor(i / W)])
  assert.ok(!path.includes(5 * W + 6))
  assert.ok(Math.abs(describe(world, cells).energy_j - costFrom(world, [2, 2], blocked).dist[target]) < 1e-6)
  const tiny = { meta: { ...world.meta, width: 2, height: 1, base_cell: [0,0] }, layers: {
    height: new Float32Array(2), slope: new Float32Array(2), terrain_class: new Uint8Array(2).fill(1), passable: new Uint8Array([1 << 4, 0]) } }
  assert.deepEqual(makeSearch(tiny)(0, 1, new Int8Array(2), new Float32Array(2)), [0,1])
  assert.equal(makeSearch(tiny)(1, 0, new Int8Array(2), new Float32Array(2)), null)
})

test('sampled worlds retain observed clear/blocked cells and use deterministic patch draws', () => {
  const meta = { width: 4, height: 4 }, known = new Int8Array(16).fill(-1), p = new Float32Array(16).fill(.5)
  known[0] = 0; known[15] = 1
  const a = sampleWorlds(meta, known, p, 12, 7)
  assert.deepEqual(a, sampleWorlds(meta, known, p, 12, 7))
  assert.ok(a.every((w) => w[0] === 0 && w[15] === 1 && w[2] === w[3]))
  assert.notDeepEqual(a, sampleWorlds(meta, known, p, 12, 8))
})

test('VOI sees only orbital inputs and known facts; exhausted/fully seen campaigns stop', () => {
  const { world, targets } = generatedWorld(2), N = world.meta.width * world.meta.height
  Object.defineProperty(world.layers, 'rocks_fine', { get() { throw new Error('Hidden truth leak') } })
  const state = { targets, route: planTour(world, targets), scanned: new Uint8Array(N), blocked: new Uint8Array(N), flights: [], maxFlights: 3, flightLimit: 1000 }
  const context = createVoiContext(world), a = chooseVoi(world, state, context), b = chooseVoi(world, state, context)
  assert.deepEqual(a.flight, b.flight)
  assert.equal(a.samples, 12)
  assert.ok(a.candidate_routes <= 3 * (state.route.stops.length + 1))
  if (a.flight) assert.ok(a.flight.metres > 0 && a.flight.metres <= 1000)
  state.scanned.fill(1)
  assert.equal(chooseVoi(world, state, context).flight, null)
  state.flights = [{}, {}, {}]
  assert.match(chooseVoi(world, state, context).reason, /budget/)
})

test('counterfactual failures remain in the objective instead of being discarded', () => {
  const { world } = generatedWorld(3), N = world.meta.width * world.meta.height
  const truth = new Uint8Array(N).fill(1), known = new Int8Array(N).fill(-1), p = new Float32Array(N)
  const result = execWalk(world, [0, N-1, 0], truth, known, p, makeSearch(world))
  assert.equal(result.completed, false)
  assert.equal(result.cost_j, 4 * world.meta.energy_budget_j)
})

test('a positive-value strip can be flown and replanned, within the shared three-flight cap', () => {
  const { world, targets } = generatedWorld(2), state = createScout(world, targets)
  // Exercise selection below the production gate; do not tune the published benchmark to pass.
  const context = createVoiContext(world, { min_gain_j: 0, spread_multiplier: 0 })
  const choice = chooseVoi(world, state, context)
  assert.ok(choice.flight?.expected_gain_j > 0)
  const flight = launchScoutFlight(world, state, () => choice.flight)
  assert.ok(flight.metres <= 1000)
  const result = completeScoutFlight(world, state)
  assert.equal(state.flights.length, 1)
  assert.ok(result.after.cells.every(([x, y]) => !state.blocked[y * world.meta.width + x]))
  state.maxFlights = 1
  assert.equal(launchScoutFlight(world, state, () => choice.flight), null)
})
