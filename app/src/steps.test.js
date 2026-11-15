import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepDetector, headingOf, bearing, turn } from './steps.js'

// Synthetic walk: gravity plus a 2 Hz bounce of ±3 m/s², sampled at 60 Hz for 10 s, plus sensor noise.
test('counts about two steps a second, ignores standing still and noise', () => {
  const detect = stepDetector()
  let steps = 0, still = 0
  for (let n = 0; n < 600; n++) {
    const t = (n * 1000) / 60
    if (detect(9.81 + 3 * Math.sin(2 * Math.PI * 2 * (t / 1000)) + 0.2 * Math.sin(n * 7.3), t)) steps++
  }
  const quiet = stepDetector()
  for (let n = 0; n < 600; n++) if (quiet(9.81 + 0.3 * Math.sin(n * 7.3), (n * 1000) / 60)) still++
  assert.ok(steps >= 18 && steps <= 21, `steps ${steps}`)
  assert.equal(still, 0)
})

test('heading: iOS compass, Android absolute alpha, nothing otherwise', () => {
  assert.equal(headingOf({ webkitCompassHeading: 90 }), 90)
  assert.equal(headingOf({ absolute: true, alpha: 90 }), 270)
  assert.equal(headingOf({ absolute: false, alpha: 90 }), null)
})

test('bearing on the grid (row 0 north) and the turn to make', () => {
  assert.equal(bearing([5, 5], [5, 4]), 0) // north
  assert.equal(bearing([5, 5], [6, 5]), 90) // east
  assert.equal(bearing([5, 5], [5, 6]), 180) // south
  assert.equal(turn(350, 10), 20) // right
  assert.equal(turn(10, 350), -20) // left
})
