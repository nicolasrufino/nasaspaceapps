import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFlights, scanAt, pointAlong, FLIGHT_M, SWATH_M } from './scout.js'

const meta = { width: 100, height: 100, cell_size_m: 5 }

test('flights cover the whole route within the configured limit, landing where the next takes off', () => {
  const route = Array.from({ length: 300 }, (_, k) => [10 + (k % 80), 10 + Math.floor(k / 80)])
  const flights = routeFlights(meta, route)
  assert.ok(flights.length > 1)
  for (const f of flights) assert.ok(f.metres <= FLIGHT_M + 1e-9)
  for (let k = 1; k < flights.length; k++) assert.deepEqual(flights[k].waypoints[0], flights[k - 1].waypoints.at(-1))
  assert.deepEqual(flights.flatMap((f, k) => (k ? f.waypoints.slice(1) : f.waypoints)), route)
})

test('scan marks a disc of SWATH_M once', () => {
  const scanned = new Uint8Array(100 * 100)
  const fresh = scanAt(meta, scanned, 50, 50)
  const r = SWATH_M / meta.cell_size_m
  assert.ok(fresh.includes(50 * 100 + 50) && fresh.includes(50 * 100 + 50 + r) && !fresh.includes(50 * 100 + 50 + r + 1))
  assert.equal(scanAt(meta, scanned, 50, 50).length, 0)
})

test('point along a path', () => {
  assert.deepEqual(pointAlong(meta, [[0, 0], [10, 0]], 25), [5, 0])
  assert.equal(pointAlong(meta, [[0, 0], [10, 0]], 51), null)
})
