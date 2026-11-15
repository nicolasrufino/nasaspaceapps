import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explainFlight, flightText } from '../src/scout-why.js'
import { createScout, launchScoutFlight, completeScoutFlight } from '../src/scout.js'
import { loadInputs } from '../../ml/pitch_metrics/run.mjs'

test('Gale flight explanations measure each landing, not the campaign total or hidden truth', () => {
  const { world, targets } = loadInputs()
  const scout = createScout(world, targets), summaries = []
  for (let f; (f = launchScoutFlight(world, scout));) {
    const result = completeScoutFlight(world, scout)
    summaries.push(explainFlight(world, result, targets))
  }
  assert.deepEqual(summaries.map((s) => s.found_cells), [21, 23, 0])
  assert.deepEqual(summaries.map((s) => s.avoided_cells), [5, 3, 0])
  assert.deepEqual(summaries.map((s) => Math.round(s.metres)), [1000, 1000, 215])
  assert.deepEqual(summaries.map((s) => Math.round(s.energy_delta_j)), [7992, 1082, 0])
  assert.ok(summaries.every((s) => s.unchanged_stops && s.stops_after === 5))
  assert.match(flightText(summaries[0], 1), /\+8\.0 kJ; 5 newly found route cells avoided; 5 stops kept/)
  assert.match(flightText(summaries[2], 3), /0\.0 kJ; 0 newly found route cells avoided/)

  const last = scout.flights[0]
  // Repeated visits and duplicated observations must not inflate distinct-cell evidence.
  const duplicate = { ...last, found: [...last.found, ...last.found], before: { ...last.before, cells: [...last.before.cells, ...last.before.cells] } }
  assert.equal(explainFlight(world, duplicate, targets).avoided_cells, 5)
  assert.equal(explainFlight(world, duplicate, targets).found_cells, 21)
  const hidden = { ...world, layers: { ...world.layers, rocks_fine: new Uint8Array(world.layers.rocks_fine.length).fill(1) } }
  assert.deepEqual(explainFlight(hidden, last, targets), summaries[0])
})

test('a cheaper plan that drops science is explicitly labelled as a changed stop selection', () => {
  const text = flightText({ metres: 200, destination: 'Base', found_cells: 1, avoided_cells: 1,
    energy_delta_j: -4000, stops_before: 5, stops_after: 4, unchanged_stops: false }, 2)
  assert.match(text, /-4\.0 kJ/)
  assert.match(text, /5 → 4 stops \(selection changed\)/)
})
