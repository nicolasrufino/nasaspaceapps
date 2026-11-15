import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { planTour } from './plan.js'
import { stretches, describe, lowestMargin, shortestAlternative } from './why.js'

function load(name) {
  const dir = new URL(`../../data/worlds/${name}/`, import.meta.url)
  const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
  const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
    .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, meta.width * meta.height)]))
  const targets = JSON.parse(readFileSync(new URL('targets.json', dir)))
  return { world: { meta, layers }, targets }
}

for (const name of ['synthetic', 'gale']) {
  const { world, targets } = load(name)
  const route = planTour(world, targets)
  const stopCells = route.stops.map((id) => targets.find((t) => t.id === id).cell)

  test(`${name}: stretches split the route at each stop and add up to the whole`, () => {
    const parts = stretches(route, stopCells)
    assert.equal(parts.length, route.stops.length + 1)
    parts.forEach((p, k) => k && assert.deepEqual(p[0], parts[k - 1].at(-1)))
    stopCells.forEach((c, k) => assert.deepEqual(parts[k].at(-1), c))
    const sum = parts.reduce((e, p) => e + describe(world, p).energy_j, 0)
    assert.ok(Math.abs(sum - route.energy_j) / route.energy_j < 1e-6, `${sum} vs ${route.energy_j}`)
  })

  test(`${name}: the shortest-distance alternative is shorter or equal, but never cheaper in energy`, () => {
    const alt = describe(world, shortestAlternative(world, stopCells))
    const chosen = describe(world, route.cells)
    assert.ok(alt.metres <= chosen.metres + 1e-6)
    assert.ok(chosen.energy_j <= alt.energy_j + 1e-6)
  })

  test(`${name}: a plan that fits never runs out of margin home`, () => {
    const low = lowestMargin(world, route.cells, world.layers.cost_to_go)
    assert.ok(low.margin_j >= -1, `${low.margin_j}`)
  })
}
