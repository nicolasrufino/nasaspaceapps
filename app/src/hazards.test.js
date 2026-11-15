import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hazardRGB, blockedSegments, reviewedMask, legendHTML, COLORS, SLOPE_WARN_DEG } from './hazards.js'

const world = (slope, rocks) => ({
  meta: { width: 2, height: 2, knobs: { max_slope_deg: 20 } },
  layers: { slope: Float32Array.from(slope), rocks_fine: Uint8Array.from(rocks) },
})

test('slope colours: under 15, 15-20, over the limit', () => {
  const rgb = hazardRGB(world([5, SLOPE_WARN_DEG + 1, 25, 5], [0, 0, 0, 0]), new Uint8Array(4))
  assert.deepEqual([...rgb.slice(0, 3)], COLORS.ok)
  assert.deepEqual([...rgb.slice(3, 6)], COLORS.warn)
  assert.deepEqual([...rgb.slice(6, 9)], COLORS.steep)
})

test('rocks: seen ones solid, unconfirmed estimates hatched, reviewed cells not hatched', () => {
  const w = world([5, 5, 5, 5], [1, 1, 1, 1])
  const rgb = hazardRGB(w, Uint8Array.from([1, 0, 0, 0]), Uint8Array.from([0, 0, 0, 1]))
  assert.deepEqual([...rgb.slice(0, 3)], COLORS.seen) // scanned
  assert.deepEqual([...rgb.slice(3, 6)], COLORS.ok) // (1,0): odd parity, hatch gap
  assert.deepEqual([...rgb.slice(6, 9)], COLORS.ok) // (0,1): odd parity
  assert.deepEqual([...rgb.slice(9, 12)], COLORS.ok) // (1,1): reviewed, not an estimate
})

test('blocked step: a wall across the crossing, centred on its midpoint, above the ground', () => {
  const seg = blockedSegments([[0, 0, 4, 'ledge', 1, 0, 4, 0, 10, 1]], () => 12, 3, 1) // east crossing
  assert.deepEqual([...seg], [4, 13, -3, 4, 13, 3])
})

test('reviewed mask covers the point and its 8 neighbours', () => {
  assert.equal(reviewedMask([{ cell: [1, 1] }], 3, 3).reduce((a, b) => a + b), 9)
})

test('legend names every colour with its meaning', () => {
  const html = legendHTML({ knobs: { max_slope_deg: 20, step_max_m: 0.3, steep_run_m: 3 } }, { blocked: 7, reviewed: 23 })
  for (const s of ['under 15°', '15–20°', 'over 20°', 'Blocked step (7)', 'Reviewed rock (23)', 'Orbit estimate', 'helicopter has seen']) {
    assert.ok(html.includes(s), s)
  }
})
