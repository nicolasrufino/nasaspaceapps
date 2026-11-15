import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cropAt, cropToTensor, rankedClasses } from './terrain-input.js'
import { fixturePixels } from '../e2e/terrain-fixture.mjs'

test('crop selection stays within the source without padding or upscaling', () => {
  assert.deepEqual(cropAt(1024, 512), { x: 384, y: 128 })
  assert.deepEqual(cropAt(1024, 512, -20, 1000), { x: 0, y: 256 })
  assert.deepEqual(cropAt(256, 256), { x: 0, y: 0 })
  assert.throws(() => cropAt(255, 1024), /at least/)
  assert.throws(() => cropAt(512, 512, NaN, 0), /at least/)
})

test('RGB resize and NCHW tensor exactly match the Python/Pillow reference', () => {
  const reference = JSON.parse(readFileSync(new URL('../e2e/terrain-reference.json', import.meta.url)))
  const tensor = cropToTensor(fixturePixels())
  assert.equal(tensor.length, 3 * 128 * 128)
  assert.equal(createHash('sha256').update(new Uint8Array(tensor.buffer)).digest('hex'), reference.tensor_sha256)
  assert.throws(() => cropToTensor(new Uint8Array(4)), /256/)
  const transparent = fixturePixels(); transparent[3] = 0
  assert.throws(() => cropToTensor(transparent), /opaque/)
})

test('scores exclude unlearned unknown, remain finite and reject corrupt output', () => {
  const result = rankedClasses([-100, 1001, 1000, -1000, 999])
  assert.equal(result[0].name, 'Soil')
  assert.equal(result.length, 4)
  assert.ok(Math.abs(result.reduce((s, c) => s + c.score, 0) - 1) < 1e-10)
  assert.throws(() => rankedClasses([0, 1, NaN, 2, 3]), /Invalid/)
  assert.throws(() => rankedClasses([0, 1, 2, 3]), /Invalid/)
})
