import assert from 'node:assert/strict'
import test from 'node:test'
import { effortComparison, parseWalkNotes } from './walk-notes.js'

test('walk overlay accepts known observation kinds in bounds', () => {
  const sample = { cell: [2, 2], kind: 'sample', value: { stop: 's1', photo: null }, time: 12 }
  const text = [JSON.stringify(sample), 'bad line', JSON.stringify({ ...sample, cell: [9, 2] }),
    JSON.stringify({ ...sample, kind: 'other' })].join('\n')
  assert.deepEqual(parseWalkNotes(text, 4, 4), [sample])
})

test('effort comparison only uses recorded comparable joule measurements', () => {
  assert.equal(effortComparison({ kind: 'effort', value: { measured_j: 140, predicted_j: 100 } }),
    'Effort: 140 J measured · 100 J predicted (+40%)')
  assert.equal(effortComparison({ kind: 'effort', value: { measured_j: 140, predicted_j: 0 } }), null)
})
