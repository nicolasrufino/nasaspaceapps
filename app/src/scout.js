// Helicopter scout (block E4). The flight is simulated; what it reveals is the world's rocks_fine layer
// (synthetic now; on real sites, rocks detected on full-resolution HiRISE images by Person 1).
// Distance per flight: 1 km, the low end of SkyFall's "~1-2 km per flight sol" (NASA SkyFall Mission Information
// Package, Sept 2026). 700 m is Ingenuity's longest flown; 2 km needs 13 m/s, above any Ingenuity flight (docs/OPERATIONS.md).

export const FLIGHT_M = 1000
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
    if (along <= d) return [ax + ((bx - ax) * along) / d, ay + ((by - ay) * along) / d]
    along -= d
  }
  return null
}
