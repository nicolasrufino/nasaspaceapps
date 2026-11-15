import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bearingDeg, turnDeg, nextStop, alertFor, remainingMetres, eta, beaconSpot } from './hud.js'

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

test('remaining metres along the route and its walking time', () => {
  const route = { cells: [[0, 0], [1, 0], [1, 1]] }
  assert.equal(remainingMetres(route, 0, 8), 16)
  assert.equal(remainingMetres(route, 2, 8), 0)
  assert.equal(eta(240, 1), '4 min')
  assert.equal(eta(3900, 1), '1 h 05')
})

test('beacon: in view stays put, out of view clamps to the edge, behind goes to the bottom', () => {
  assert.deepEqual(beaconSpot([400, 300, false], 800, 600), { x: 400, y: 300, off: false })
  assert.equal(beaconSpot([2000, 300, false], 800, 600).x, 766)
  assert.equal(beaconSpot([2000, 300, false], 800, 600).off, true)
  const b = beaconSpot([100, 300, true], 800, 600)
  assert.equal(b.off, true)
  assert.equal(b.x, 700)
})
