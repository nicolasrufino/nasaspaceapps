import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { bestAreas } from './best-areas.js'

function load(name) {
  const dir = new URL(`../../data/worlds/${name}/`, import.meta.url)
  const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
  const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
    .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, meta.width * meta.height)]))
  return { meta, layers }
}

for (const name of ['synthetic', 'gale']) {
  const world = load(name)
  const { meta, layers } = world
  const n = meta.width * meta.height

  test(`${name}: best areas are zero where the round trip doesn't fit or rocks were seen`, () => {
    const scanned = new Uint8Array(n).fill(1)
    const blocked = Uint8Array.from(layers.rocks_fine)
    const s = bestAreas(world, layers.cost_to_go_scouted, scanned, blocked)
    const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
    for (let i = 0; i < n; i++) {
      if (blocked[i] || layers.cost_to_go_scouted[i] > usable) assert.equal(s[i], 0)
      assert.ok(s[i] >= 0 && s[i] <= 1)
    }
    const home = meta.base_cell[1] * meta.width + meta.base_cell[0]
    const sci = layers.science ? 0.4 + 0.2 * layers.science[home] : 1 // same science weight as bestAreas
    assert.ok(s[home] > 0.99 * sci) // home: nothing to spend
  })
}
