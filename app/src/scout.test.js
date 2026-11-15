import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFlights, scanAt, pointAlong, FLIGHT_M, SWATH_M, nextRouteFlight, scanFlight, createScout, launchScoutFlight, completeScoutFlight } from './scout.js'
import { readFileSync } from 'node:fs'
import { parseLayer } from './world.js'

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

test('the next flight starts on unseen route and slow frames do not skip scans or endpoints', () => {
  const route = [[10, 10], [90, 10], [90, 90]]
  const seen = new Uint8Array(10000)
  scanAt(meta, seen, 10, 10)
  const f = nextRouteFlight(meta, route, seen, 101)
  assert.ok(f.route_start_m > 0)
  assert.equal(f.metres, 101)
  const whole = seen.slice(), ticks = seen.slice()
  scanFlight(meta, whole, { ...f })
  const animated = { ...f }
  for (const d of [0, 3, 44, 100, 101]) scanFlight(meta, ticks, animated, d)
  assert.deepEqual(ticks, whole)
  const end = f.waypoints.at(-1)
  assert.equal(ticks[Math.round(end[1]) * meta.width + Math.round(end[0])], 1)
  assert.equal(nextRouteFlight(meta, route, new Uint8Array(10000).fill(1)), null)
  assert.equal(nextRouteFlight(meta, [], seen), null)
})

test('Gale campaign replans after each flight, stops at three and clears the five-stop route', () => {
  const dir = new URL('../../data/worlds/gale/', import.meta.url)
  const read = (f) => readFileSync(new URL(f, dir))
  const meta = JSON.parse(read('world.json')), n = meta.width * meta.height
  const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(u8|f32)$/.test(f))
    .map(([k, f]) => [k, parseLayer(f, new Uint8Array(read(f)).buffer, n)]))
  const world = { meta, layers }, targets = JSON.parse(read('targets.json'))
  const state = createScout(world, targets)
  const before = state.route
  while (launchScoutFlight(world, state)) {
    const f = state.active
    assert.ok(f.metres > 0 && f.metres <= FLIGHT_M)
    assert.equal(f.before, state.route)
    const result = completeScoutFlight(world, state)
    assert.equal(state.route, result.after)
    assert.ok(state.route.cells.every(([x, y]) => !state.blocked[y * meta.width + x]))
  }
  assert.equal(state.flights.length, 3)
  assert.equal(launchScoutFlight(world, state), null)
  assert.equal(completeScoutFlight(world, state), null)
  assert.notDeepEqual(state.flights[0].after.cells, before.cells)
  assert.deepEqual(new Set(state.route.stops), new Set(before.stops))
  assert.equal(state.route.stops.length, 5)
  assert.ok(state.route.cells.every(([x, y]) => state.scanned[y * meta.width + x] && !layers.rocks_fine[y * meta.width + x]))
})
