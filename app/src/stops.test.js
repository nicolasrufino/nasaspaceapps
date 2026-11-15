import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stopIndices, contextCard, warnings } from './stops.js'
import * as log from './log.js'

test('stops are found in order along the route, base excluded', () => {
  const cells = [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0]]
  assert.deepEqual([...stopIndices(cells, [[2, 0], [1, 0]])], [[2, 0], [3, 1]])
  assert.equal(stopIndices(cells, [[9, 9]]).size, 0)
})

test('walk log entries follow contract §3 and round-trip through storage', () => {
  assert.deepEqual(log.entry([3, 4], 'marker', { id: 'M1' }, 12.5), { cell: [3, 4], kind: 'marker', value: { id: 'M1' }, time: 12.5 })
  assert.throws(() => log.entry([0, 0], 'selfie', null, 0))
  const mem = new Map()
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  log.append(storage, { t: 0, mode: 'route' })
  log.append(storage, log.entry([1, 2], 'sample', { stop: 'A' }, 3))
  assert.deepEqual(log.read(storage).map((l) => l.kind ?? l.mode), ['route', 'sample'])
  log.clear(storage)
  assert.deepEqual(log.read(storage), [])
})

test('context card reads every layer at the stop cell', () => {
  const world = { meta: { width: 2 }, layers: { height: new Float32Array([0, 1.23456, 2, 3]), terrain_class: new Uint8Array([0, 3, 0, 0]) } }
  const card = contextCard(world, { id: 'A', name: 'Ridge', cell: [1, 0] }, { image_url: 'x.jpg' }, 60)
  assert.deepEqual(card, { stop: 'A', name: 'Ridge', goal: null, layers: { height: 1.235, terrain_class: 3 }, photo: 'x.jpg', time: 60 })
})

test('warnings: reserve, point of no return, low margin, at a stop', () => {
  const meta = { energy_budget_j: 600000, reserve_fraction: 0.2 }
  assert.deepEqual(warnings(meta, { energy_left_j: 500000 }, 200000, false), [])
  assert.match(warnings(meta, { energy_left_j: 500000 }, 30000, false)[0], /Turn back soon: 30 kJ/)
  assert.match(warnings(meta, { energy_left_j: 500000 }, -1, false)[0], /point of no return/)
  assert.match(warnings(meta, { energy_left_j: 100000 }, -1, true)[0], /Oxygen below the reserve/)
  assert.match(warnings(meta, { energy_left_j: 500000 }, 200000, true)[0], /At a stop/)
})
