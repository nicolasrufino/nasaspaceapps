// Helicopter scout (block E4). The flight is simulated; what it reveals is the world's rocks_fine layer
// (synthetic now; on real sites, rocks detected on full-resolution HiRISE images by Person 1).
// SkyFall scenario: 1 km per flight, the low end of its design expectation.
// This is not an Ingenuity flight record (docs/OPERATIONS.md).

import { planTour } from './plan.js'

export const FLIGHT_M = 1000
export const MAX_FLIGHTS = 3
export const FLIGHT_ANIMATION_S = 10 // playback only; not a physical speed
export const SCAN_STEP_M = 2 // spatial sampling, independent of animation frame rate
export const SWATH_M = 15 // ponytail: radius the camera sees from scouting height; tune with the real camera footprint

// Split the planned route into flights of at most FLIGHT_M metres; each lands where the next takes off.
export function routeFlights(meta, cells) {
  const flights = []
  let cur = [cells[0]], metres = 0
  for (let k = 1; k < cells.length; k++) {
    const d = meta.cell_size_m * Math.hypot(cells[k][0] - cells[k - 1][0], cells[k][1] - cells[k - 1][1])
    if (metres + d > FLIGHT_M) {
      flights.push({ waypoints: cur, metres })
      cur = [cells[k - 1]]
      metres = 0
    }
    cur.push(cells[k])
    metres += d
  }
  if (cur.length > 1) flights.push({ waypoints: cur, metres })
  return flights
}

// Mark every cell within SWATH_M of (x, y) as scouted; returns the indices seen for the first time.
// ponytail: a grid lookup stands in for raycasting onto a full-detail mesh; same cells, no extra mesh.
export function scanAt(meta, scanned, x, y) {
  const { width: W, height: H, cell_size_m: cs } = meta
  const r = SWATH_M / cs
  const fresh = []
  for (let cy = Math.max(0, Math.ceil(y - r)); cy <= Math.min(H - 1, Math.floor(y + r)); cy++) {
    for (let cx = Math.max(0, Math.ceil(x - r)); cx <= Math.min(W - 1, Math.floor(x + r)); cx++) {
      const i = cy * W + cx
      if (!scanned[i] && (cx - x) ** 2 + (cy - y) ** 2 <= r * r) {
        scanned[i] = 1
        fresh.push(i)
      }
    }
  }
  return fresh
}

// Point at distance `along` (metres) on a waypoint path, in cell units, or null past the end.
export function pointAlong(meta, waypoints, along) {
  for (let k = 1; k < waypoints.length; k++) {
    const [ax, ay] = waypoints[k - 1], [bx, by] = waypoints[k]
    const d = meta.cell_size_m * Math.hypot(bx - ax, by - ay)
    if (!d) continue
    if (along <= d) return [ax + ((bx - ax) * along) / d, ay + ((by - ay) * along) / d]
    along -= d
  }
  return null
}

export const pathMetres = (meta, cells) => cells.reduce((m, c, k) => k
  ? m + meta.cell_size_m * Math.hypot(c[0] - cells[k - 1][0], c[1] - cells[k - 1][1]) : 0, 0)

// F4: take the next unseen stretch of the CURRENT route, then land and re-plan.
// As in flight-budget-check.mjs, this is a corridor simulation: repositioning
// from the habitat, recharge and helicopter energy are not modelled.
export function nextRouteFlight(meta, cells, scanned, limit = FLIGHT_M) {
  const total = pathMetres(meta, cells)
  if (!total || !(limit > 0)) return null
  let start = 0
  for (; start < total; start += SCAN_STEP_M) {
    const p = pointAlong(meta, cells, start)
    if (!scanned[Math.round(p[1]) * meta.width + Math.round(p[0])]) break
  }
  if (start >= total) return null
  const end = Math.min(total, start + limit)
  const waypoints = [pointAlong(meta, cells, start)]
  let along = 0
  for (let k = 1; k < cells.length; k++) {
    along += meta.cell_size_m * Math.hypot(cells[k][0] - cells[k - 1][0], cells[k][1] - cells[k - 1][1])
    if (along > start && along < end) waypoints.push(cells[k])
  }
  waypoints.push(pointAlong(meta, cells, end) ?? cells.at(-1))
  return { waypoints, metres: end - start, route_start_m: start, kind: 'next unseen route stretch' }
}

// Scan every 2 m crossed since the previous tick, including takeoff and landing.
// A slow frame must not jump over hazards; preview and R5 use this same function.
export function scanFlight(meta, scanned, f, through = f.metres) {
  const end = Math.min(through, f.metres), fresh = []
  let a = f.next_sample_m ?? 0
  for (; a <= end; a += SCAN_STEP_M) {
    const p = pointAlong(meta, f.waypoints, a) ?? f.waypoints.at(-1)
    fresh.push(...scanAt(meta, scanned, ...p))
  }
  f.next_sample_m = a
  if (end === f.metres) fresh.push(...scanAt(meta, scanned, ...f.waypoints.at(-1)))
  return fresh
}

export function createScout(world, targets, { scanned, maxFlights = MAX_FLIGHTS, flightLimit = FLIGHT_M } = {}) {
  const seen = scanned ?? new Uint8Array(world.meta.width * world.meta.height)
  const blocked = Uint8Array.from(seen, (v, i) => v && world.layers.rocks_fine?.[i])
  return { targets, scanned: seen, blocked, route: planTour(world, targets, blocked),
    maxFlights, flightLimit, flights: [], active: null }
}

export function launchScoutFlight(world, scout) {
  if (scout.active) return scout.active
  if (scout.flights.length >= scout.maxFlights) return null
  const f = nextRouteFlight(world.meta, scout.route.cells, scout.scanned, scout.flightLimit)
  scout.active = f ? { ...f, before: scout.route } : null
  return scout.active
}

export function completeScoutFlight(world, scout) {
  const f = scout.active
  if (!f) return null
  scanFlight(world.meta, scout.scanned, f)
  const found = []
  scout.scanned.forEach((v, i) => {
    if (v && world.layers.rocks_fine?.[i] && !scout.blocked[i]) { scout.blocked[i] = 1; found.push(i) }
  })
  scout.route = planTour(world, scout.targets, scout.blocked)
  const result = { ...f, after: scout.route, found }
  scout.flights.push(result)
  scout.active = null
  return result
}
