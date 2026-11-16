import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stopCheck } from './goal.js'

test('every Curiosity stop names its check', () => {
  const targets = JSON.parse(readFileSync(new URL('../../../data/worlds/gale/targets.json', import.meta.url)))
  for (const t of targets) assert.ok(stopCheck(t.id), t.id)
})
