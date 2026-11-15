import test from 'node:test'
import assert from 'node:assert/strict'
import { stripRecord, remsRange, footprintM, payloadOff, INSTRUMENTS } from './scout-payload.js'

test('a strip record reads shares, dose and rocks from the layers', () => {
  const layers = { landform: Uint8Array.of(2, 3, 0, 2), dose_rate: Float32Array.of(0.2, 0.4, NaN, 0), rocks_fine: Uint8Array.of(0, 1, 0, 0) }
  const r = stripRecord(layers, [0, 1, 2, 3], 8)
  assert.equal(r.area_m2, 256)
  assert.equal(r.ridge, 0.5); assert.equal(r.hollow, 0.25)
  assert.ok(Math.abs(r.dose - 0.2) < 1e-6)
  assert.equal(r.rocks, 1)
})

test('a missing layer gives null, not zero', () => {
  const r = stripRecord({}, [0, 1], 8)
  assert.equal(r.ridge, null); assert.equal(r.dose, null); assert.equal(r.rocks, null)
})

test('REMS range, footprint, kill switch, six rows', () => {
  assert.deepEqual(remsRange({ sols: [{ min_temp_c: -77, max_temp_c: -24 }, { min_temp_c: -80, max_temp_c: -20 }] }), { min: -80, max: -20, sols: 2 })
  assert.equal(remsRange(null), null)
  assert.ok(Math.abs(footprintM() - 26.5) < 0.1) // 2 × 10 m × tan 53°
  assert.equal(payloadOff('?off=scout_payload'), true)
  assert.equal(payloadOff('?off=x,scout_payload'), true)
  assert.equal(payloadOff(''), false)
  assert.equal(INSTRUMENTS.length, 6)
})
