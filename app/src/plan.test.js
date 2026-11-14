import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { startWalk, stepTo } from './walk.js'
import { costFrom, planTour } from './plan.js'

const dir = new URL('../../data/worlds/synthetic/', import.meta.url)
const read = (f) => readFileSync(new URL(f, dir))
const meta = JSON.parse(read('world.json'))
const layers = Object.fromEntries(Object.entries(meta.files).map(([k, f]) =>
  [k, parseLayer(f, new Uint8Array(read(f)).buffer, meta.width * meta.height)]))
const world = { meta, layers }
const targets = JSON.parse(read('targets.json'))
const outAndBack = JSON.parse(read('route.json')).energy_j
const at = (c) => c[1] * meta.width + c[0]

test('cost from a target to base equals the pipeline cost_to_go (same energy and slope rules)', () => {
  for (const t of targets) {
    const d = costFrom(world, t.cell).dist[at(meta.base_cell)]
    const c = layers.cost_to_go[at(t.cell)]
    assert.ok(Math.abs(d - c) / c < 1e-3, `${t.id}: ${d} vs ${c}`)
  }
})

test('with enough energy, one loop visits every stop for less than out-and-back trips', () => {
  const plan = planTour({ meta: { ...meta, energy_budget_j: 1e9 }, layers }, targets)
  assert.equal(plan.stops.length, targets.length)
  assert.ok(plan.energy_j < outAndBack, `${plan.energy_j} vs ${outAndBack}`)
})

test('plan fits the budget with the reserve, is walkable, and never trips the point of no return', () => {
  const plan = planTour(world, targets)
  assert.ok(plan.energy_j <= meta.energy_budget_j * (1 - meta.reserve_fraction))
  assert.deepEqual(plan.cells[0], meta.base_cell)
  assert.deepEqual(plan.cells.at(-1), meta.base_cell)
  plan.cells.slice(1).forEach((c, k) => {
    const p = plan.cells[k]
    assert.ok(Math.max(Math.abs(c[0] - p[0]), Math.abs(c[1] - p[1])) === 1, `jump at ${k}`)
    assert.ok(layers.slope[at(c)] <= meta.knobs.max_slope_deg, `too steep at ${c}`)
  })
  const walk = startWalk(meta)
  assert.ok(!plan.cells.slice(1).some((c) => stepTo(world, walk, c)))
  assert.ok(Math.abs(meta.energy_budget_j - walk.energy_left_j - plan.energy_j) < 1)
  assert.equal(plan.stops.length + plan.dropped.length, targets.length)
})

test('blocked cells are avoided', () => {
  const plan = planTour({ meta: { ...meta, energy_budget_j: 1e9 }, layers }, targets)
  const blocked = new Uint8Array(meta.width * meta.height)
  blocked[at(plan.cells[Math.floor(plan.cells.length / 2)])] = 1
  const again = planTour({ meta: { ...meta, energy_budget_j: 1e9 }, layers }, targets, blocked)
  assert.ok(!again.cells.some((c) => blocked[at(c)]))
  assert.ok(again.energy_j >= plan.energy_j)
})
