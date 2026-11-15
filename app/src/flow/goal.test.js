import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scienceGoalOn, stopCheck } from './goal.js'

test('science_goal is on by default, off with ?off=…,science_goal', () => {
  assert.equal(scienceGoalOn(''), true)
  assert.equal(scienceGoalOn('?off=detail'), true)
  assert.equal(scienceGoalOn('?off=detail,science_goal'), false)
})

test('every Curiosity stop names its check', () => {
  const targets = JSON.parse(readFileSync(new URL('../../../data/worlds/gale/targets.json', import.meta.url)))
  for (const t of targets) assert.ok(stopCheck(t.id), t.id)
})
