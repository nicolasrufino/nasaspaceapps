import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bearingDeg, turnDeg, nextStop, alertFor } from './hud.js'

test('bearing: north is -z, east is +x', () => {
  assert.equal(bearingDeg(0, -1), 0)
  assert.equal(bearingDeg(1, 0), 90)
  assert.equal(bearingDeg(0, 1), 180)
  assert.equal(bearingDeg(-1, 0), 270)
})

test('turn is the short way round', () => {
  assert.equal(turnDeg(350, 10), 20)
  assert.equal(turnDeg(10, 350), -20)
})

test('next stop: distance along the route, then the habitat', () => {
  const route = { cells: [[0, 0], [1, 0], [2, 1], [2, 2], [0, 0]], stops: ['a'] }
  const stops = [{ id: 'a', name: 'Ridge', cell: [2, 1] }, { id: 'b', name: 'Not planned', cell: [2, 2] }]
  const n = nextStop(route, 0, stops, 8)
  assert.equal(n.name, 'Ridge')
  assert.ok(Math.abs(n.metres - (8 + 8 * Math.SQRT2)) < 1e-9)
  assert.equal(nextStop(route, 2, stops, 8).name, 'Habitat')
  assert.equal(nextStop(route, 4, stops, 8), null)
})

test('alerts: none, turn back soon, point of no return', () => {
  assert.equal(alertFor(500, 0.5), null)
  assert.equal(alertFor(50, 0.1).level, 'warn')
  assert.equal(alertFor(-1, 0).level, 'danger')
})
