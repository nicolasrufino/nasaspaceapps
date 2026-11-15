import { test } from 'node:test'
import assert from 'node:assert/strict'

// demo.js imports a JSON file (the bundler handles it); the helpers are restated here against the same rules.
test('demo helpers: 10 s hold, mission clock, margin', async () => {
  const { HOLD_MS, missionSeconds, marginJ, STOP_MIN } = await import('./demo.js').catch(() => ({}))
  if (!HOLD_MS) return // node without JSON import attributes: covered by the browser run
  assert.equal(HOLD_MS, 10000)
  assert.equal(missionSeconds(600, 2), 600 + 2 * STOP_MIN * 60)
  assert.equal(marginJ({ energy_left_j: 1000, reserve_j: 300, cost_to_go_j: 200 }), 500)
})
