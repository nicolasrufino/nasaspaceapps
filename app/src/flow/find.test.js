// The JS boxwork score and check against data/pipeline/science_probe.py's output (ml/exports/science_probe.json).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { boxworkScore, percentile, roverCheck, findOn } from './find.js'

const world = (f) => new URL(`../../../data/worlds/gale/${f}`, import.meta.url)
const meta = JSON.parse(readFileSync(world('world.json')))
const probe = JSON.parse(readFileSync(new URL('../../../ml/exports/science_probe.json', import.meta.url)))
const W = meta.width, H = meta.height
const score = boxworkScore(new Uint8Array(readFileSync(world('landform.u8'))), W, H)

test('stop percentiles match science_probe.py', () => {
  for (const t of JSON.parse(readFileSync(world('targets.json')))) assert.equal(percentile(score, W, t.cell), probe.stop_percentile_on_score[t.id], t.id)
})

test('rover check matches science_probe.py', () => {
  const c = roverCheck(score, W, JSON.parse(readFileSync(world('chem_points.json'))))
  assert.equal(c.inside.length, probe.rover_cells.inside)
  assert.equal(c.outside.length, probe.rover_cells.outside)
  assert.equal(Math.round(c.auc * 1000) / 1000, probe.rover_cells.auc_inside_vs_outside)
})

test('candidate scores match candidates.json', () => {
  for (const c of JSON.parse(readFileSync(world('candidates.json')))) assert.equal(Math.round(score[c.cell[1] * W + c.cell[0]] * 1000) / 1000, c.score, c.id)
})

test('?off=find turns it off', () => {
  assert.equal(findOn(''), true)
  assert.equal(findOn('?off=hud,find'), false)
})
