import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { FLIGHT_M } from './scout.js'
import { surveyPlan, scanSegment, bestAreas } from './survey.js'

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

  test(`${name}: flying the whole survey maps every cell, each flight within the limit`, () => {
    const plan = surveyPlan(meta, layers.cost_to_go)
    const scanned = new Uint8Array(n)
    for (const f of plan.flights) {
      assert.ok(f.metres <= FLIGHT_M)
      scanSegment(meta, scanned, f.waypoints[0], f.waypoints[1])
    }
    assert.equal(scanned.reduce((a, v) => a + v, 0), n)
  })

  test(`${name}: reachable ground is surveyed first; more helicopters, fewer sols`, () => {
    const one = surveyPlan(meta, layers.cost_to_go, { helicopters: 1 })
    const three = surveyPlan(meta, layers.cost_to_go, { helicopters: 3 })
    const firstFar = one.flights.findIndex((f) => !f.reachable)
    assert.ok(firstFar > 0 && one.flights.slice(firstFar).every((f) => !f.reachable))
    assert.ok(three.solsReachable < three.sols && three.sols < one.sols)
    assert.equal(three.sols, Math.ceil(one.flights.length / 3))
  })

  test(`${name}: best areas are zero where the round trip doesn't fit or rocks were seen`, () => {
    const scanned = new Uint8Array(n).fill(1)
    const blocked = Uint8Array.from(layers.rocks_fine)
    const s = bestAreas(world, layers.cost_to_go_scouted, scanned, blocked)
    const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
    for (let i = 0; i < n; i++) {
      if (blocked[i] || layers.cost_to_go_scouted[i] > usable) assert.equal(s[i], 0)
      assert.ok(s[i] >= 0 && s[i] <= 1)
    }
    assert.ok(s[meta.base_cell[1] * meta.width + meta.base_cell[0]] > 0.99) // home: nothing to spend
  })
}
