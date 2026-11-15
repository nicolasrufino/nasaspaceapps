import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizePayloadFlight, scoutPayloadEnabled, latestWeather, CAMERA_FOOTPRINT_M } from './scout-payload.js'

test('payload is off by default; its local switch keeps the guided flow URL', () => {
  for (const search of ['', '?flags=', '?flags=scout_payload', '?scout_payload=0', '?scout_payload=false']) assert.equal(scoutPayloadEnabled(search), false)
  assert.equal(scoutPayloadEnabled('?scout_payload=1'), true)
  assert.ok(Math.abs(CAMERA_FOOTPRINT_M - 26.5409) < 0.001)
})

test('landing metrics count overlapping strip cells once, clip edges, and preserve inputs', () => {
  const world = { meta: { width: 5, height: 3, cell_size_m: 10 }, layers: {
    landform: Uint8Array.from([2, 2, 3, 0, 2, 2, 2, 3, 0, 2, 2, 2, 3, 0, 2]),
    dose_rate: Float32Array.from([2, 4, 6, 8, 100, 2, 4, 6, 8, 100, 2, 4, 6, 8, 100]),
    rocks_fine: Uint8Array.from([1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1]),
  } }
  // Out and back: x=0..3 in all three rows (12 cells), not the fifth column.
  const flight = { waypoints: [[0, 1], [2, 1], [0, 1]], metres: 40, next_sample_m: 42 }
  const before = structuredClone({ world, flight })
  const report = summarizePayloadFlight(world, flight)
  assert.deepEqual(report, { metres: 40, cells: 12, area_m2: 1200, ridge_share: 0.5,
    hollow_share: 0.25, mean_dose_rate_ugy_h: 5, rock_cells: 3,
    landform_samples: 12, dose_samples: 12, rock_samples: 12 })
  assert.deepEqual(summarizePayloadFlight(world, flight), report) // later flight over the same ground
  assert.deepEqual({ world, flight }, before)
})

test('missing and invalid optional data stays unavailable, not zero', () => {
  const meta = { width: 2, height: 1, cell_size_m: 8 }
  const flight = { waypoints: [[0, 0], [1, 0]], metres: 8 }
  const missing = summarizePayloadFlight({ meta, layers: {} }, flight)
  assert.equal(missing.ridge_share, null)
  assert.equal(missing.hollow_share, null)
  assert.equal(missing.mean_dose_rate_ugy_h, null)
  assert.equal(missing.rock_cells, null)
  const partial = summarizePayloadFlight({ meta, layers: {
    landform: [2, 255], dose_rate: [0, NaN], rocks_fine: [0, undefined],
  } }, flight)
  assert.equal(partial.ridge_share, 1)
  assert.equal(partial.hollow_share, 0)
  assert.equal(partial.mean_dose_rate_ugy_h, 0)
  assert.equal(partial.rock_cells, 0)
  assert.equal(partial.landform_samples, 1)
  assert.equal(partial.dose_samples, 1)
})

test('REMS context identifies the latest valid historical sol without changing source order', () => {
  const old = { sol: 4, min_temp_c: -80, max_temp_c: -20 }
  const recent = { sol: 5, min_temp_c: -75, max_temp_c: -15 }
  const weather = { sols: [recent, { sol: 6, min_temp_c: null }, old] }
  assert.equal(latestWeather(weather), recent)
  assert.equal(weather.sols[2], old)
  assert.equal(latestWeather(null), null)
})
