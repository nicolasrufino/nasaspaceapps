import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { stepCost, startWalk, stepTo, freeStep, ringMask, ringLimit, oxygenL } from './walk.js'

const dir = new URL('../../data/worlds/synthetic/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
const layers = Object.fromEntries(Object.entries(meta.files).map(([k, f]) =>
  [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, meta.width * meta.height)]))
const world = { meta, layers }
const ctg = (c) => layers.cost_to_go[c[1] * meta.width + c[0]]

// Walk home along Dijkstra's own choice: the neighbour minimising step cost + its cost_to_go.
function homeFrom(start) {
  const path = [start]
  for (let c = start; ctg(c) > 0;) {
    const nb = []
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      if ((dx || dy) && c[0] + dx >= 0 && c[0] + dx < meta.width && c[1] + dy >= 0 && c[1] + dy < meta.height) nb.push([c[0] + dx, c[1] + dy])
    const via = (n) => stepCost(meta, layers.height, layers.terrain_class, c, n) + ctg(n)
    c = nb.reduce((a, b) => (via(b) < via(a) ? b : a))
    path.push(c)
  }
  return path
}

test('energy drain matches the pipeline: walking home costs exactly cost_to_go', () => {
  const route = JSON.parse(readFileSync(new URL('route.json', dir))).cells
  for (const start of [route[40], route[120], route[170]]) {
    const path = homeFrom(start)
    let used = 0
    for (let k = 1; k < path.length; k++) used += stepCost(meta, layers.height, layers.terrain_class, path[k - 1], path[k])
    assert.ok(Math.abs(used - ctg(start)) / ctg(start) < 1e-3, `${start}: walked ${used} J, cost_to_go ${ctg(start)} J`)
  }
})

test('point of no return fires once, when the current cell leaves the ring', () => {
  const route = JSON.parse(readFileSync(new URL('route.json', dir))).cells
  const walk = startWalk(meta)
  const crossings = []
  route.slice(1).forEach((c, k) => stepTo(world, walk, c) && crossings.push(k))
  assert.equal(crossings.length, 1)
  assert.ok(walk.energy_left_j < meta.energy_budget_j)
})

test('ring mask', () => {
  assert.deepEqual([...ringMask(new Float32Array([0, 5, 3e38]), 5)], [1, 1, 0])
  assert.equal(ringLimit(meta, startWalk(meta)), meta.energy_budget_j * (1 - meta.reserve_fraction))
})

test('free walk: energy drains once per new cell, the same as the route walk, and oxygen follows it', () => {
  const cs = meta.cell_size_m, free = startWalk(meta), route = startWalk(meta)
  const [bx, by] = meta.base_cell
  for (let i = 1; i <= 5; i++) {
    for (let f = 0; f < 4; f++) freeStep(world, free, (bx + i - 1 + f / 4 + 0.3) * cs, by * cs) // several frames inside one cell
    stepTo(world, route, [bx + i, by])
  }
  assert.deepEqual(free.cell, [bx + 5, by])
  assert.equal(free.energy_left_j, route.energy_left_j)
  assert.equal(free.t, route.t)
  assert.ok(free.energy_left_j < meta.energy_budget_j)
  assert.ok(oxygenL(meta, free.energy_left_j) < oxygenL(meta, meta.energy_budget_j))
  assert.equal(freeStep(world, free, (bx + 5) * cs, by * cs), false) // standing still costs nothing
  const before = free.energy_left_j
  freeStep(world, free, -50, -50) // walking off the map clamps to the edge cell
  assert.ok(free.cell[0] >= 0 && free.cell[1] >= 0 && free.energy_left_j < before)
})
