import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tally, stopSteps, TASKS, STOP_MIN } from './stop-science.js'

const data = JSON.parse(readFileSync(new URL('../../../data/worlds/gale/stop_science.json', import.meta.url)))

test('all six tasks fit the 30-minute planning assumption', () => {
  assert.equal(TASKS.reduce((a, t) => a + t.min, 0) <= STOP_MIN, true)
})

test('stop dose = dose rate × minutes ÷ 60, read from the file', () => {
  const rec = data.stops[0]
  const { minutes, dose_ugy } = tally(['look', 'chem'], rec)
  assert.equal(minutes, 11)
  assert.equal(dose_ugy, +((rec.dose_ugy_per_hour * 11) / 60).toFixed(2))
  assert.deepEqual(tally([], rec), { minutes: 0, dose_ugy: 0 })
})

test('every stop in the file has a chemistry reading with instrument and sol', () => {
  for (const s of data.stops) assert.ok(s.chem.instrument && s.chem.sol && s.chem.oxides_wt_pct.MgO != null, s.target_id)
})

test('stop steps follow the walking order along the route', () => {
  const cells = [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0]]
  const stops = [{ id: 'a', cell: [1, 0] }, { id: 'b', cell: [2, 0] }]
  assert.deepEqual(stopSteps(cells, ['b', 'a'], stops).map((s) => [s.id, s.k]), [['b', 2], ['a', 3]])
})
