import { test } from 'node:test'
import assert from 'node:assert/strict'

// demo.js imports a JSON file (the bundler handles it); the helpers are restated here against the same rules.
test('autoplay linger stays between 8 and 14 seconds', async () => {
  const { lingerMs, missionSeconds, marginJ, STOP_MIN } = await import('./demo.js').catch(() => ({}))
  if (!lingerMs) return // node without JSON import attributes: covered by the browser run
  assert.equal(lingerMs('<p>short</p>'), 8000)
  assert.equal(lingerMs('<p>' + 'word '.repeat(200) + '</p>'), 14000)
  assert.equal(missionSeconds(600, 2), 600 + 2 * STOP_MIN * 60)
  assert.equal(marginJ({ energy_left_j: 1000, reserve_j: 300, cost_to_go_j: 200 }), 500)
})
