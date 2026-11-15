import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'
import { beliefMap } from './belief.js'

const dir = new URL('../../data/worlds/gale/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
const N = meta.width * meta.height
const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f))
  .map(([k, f]) => [k, parseLayer(f, new Uint8Array(readFileSync(new URL(f, dir))).buffer, N)]))
const world = { meta, layers }

test('belief: chances are between 0 and 1 and their average is close to the rock rate', () => {
  const p = beliefMap(world)
  let mean = 0, rate = 0
  for (let i = 0; i < N; i++) {
    assert.ok(p[i] >= 0 && p[i] <= 1)
    mean += p[i] / N
    rate += layers.rocks_fine[i] / N
  }
  assert.ok(Math.abs(mean - rate) < 0.02, `mean ${mean} vs rate ${rate}`)
})

test('belief: cells the helicopter has seen become certain', () => {
  const scanned = new Uint8Array(N), blocked = new Uint8Array(N)
  scanned[10] = 1; scanned[11] = 1; blocked[11] = 1
  const p = beliefMap(world, scanned, blocked)
  assert.equal(p[10], 0)
  assert.equal(p[11], 1)
})
