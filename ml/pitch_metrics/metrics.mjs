// R5 measurements reuse the shipped app's planner, energy and scout functions.
// No training, new navigation model, or changes to the world are performed.
import { costFrom, energyCost, planTour } from '../../app/src/plan.js'
import { describe } from '../../app/src/why.js'
import { stepCost, reserveJ } from '../../app/src/walk.js'
import { routeFlights, scanAt, pointAlong } from '../../app/src/scout.js'

const at = (meta, [x, y]) => y * meta.width + x
const count = (values) => values.reduce((sum, value) => sum + Number(Boolean(value)), 0)

export function hazardContacts(meta, cells, mask) {
  const visits = cells.filter((c) => mask[at(meta, c)])
  const unique = [...new Set(visits.map((c) => at(meta, c)))].sort((a, b) => a - b)
  return { unique_cells: unique.length, cell_visits: visits.length,
    cells: unique.map((i) => [i % meta.width, Math.floor(i / meta.width)]) }
}

export function simulateScout(world, route, extraFlights, mode = '60fps', previouslyScanned = null) {
  const { meta, layers } = world
  const flights = [...routeFlights(meta, route.cells), ...extraFlights]
  const scanned = previouslyScanned ? Uint8Array.from(previouslyScanned) : new Uint8Array(meta.width * meta.height)
  if (scanned.length !== meta.width * meta.height) throw new Error('Wrong scout mask size')
  const priorHazards = count(scanned.map((v, i) => v && layers.rocks_fine[i]))
  if (mode === 'spatial4m') {
    // Deterministic spatial audit, includes endpoints. The current UI instead
    // samples at animation frames; do not label this as an exact UI replay.
    for (const f of flights) for (let k = 1; k < f.waypoints.length; k++) {
      const [a, b] = [f.waypoints[k - 1], f.waypoints[k]]
      const distance = meta.cell_size_m * Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.ceil(distance / 4))
      for (let s = 0; s <= n; s++) scanAt(meta, scanned, a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n)
    }
  } else {
    const fps = Number(mode.replace('fps', ''))
    if (![30, 60, 120].includes(fps)) throw new Error('Unsupported fixed frame rate')
    const speed = flights.reduce((sum, f) => sum + f.metres, 0) / 9
    if (!(speed > 0)) throw new Error('Scout path has no length')
    // Mirrors main.js tickFlight: cap dt, advance before scanning, reset on
    // flight change, discard overshoot and do not add an unobserved endpoint.
    for (const f of flights) {
      let along = 0, ticks = 0
      for (;;) {
        if (++ticks > 100000) throw new Error('Scout simulation did not terminate')
        along += speed * Math.min(1 / fps, .1)
        const point = pointAlong(meta, f.waypoints, along)
        if (!point) break
        scanAt(meta, scanned, ...point)
      }
    }
  }
  const blocked = Uint8Array.from(scanned, (seen, i) => seen && layers.rocks_fine[i])
  // This is the app's existing per-cell switch, not a fresh partial-map search.
  const displayedReturn = Float64Array.from(layers.cost_to_go,
    (value, i) => scanned[i] ? layers.cost_to_go_scouted[i] : value)
  return { scanned, blocked, displayedReturn, flights: flights.length,
    flight_metres: flights.reduce((sum, f) => sum + f.metres, 0),
    scanned_cells: count(scanned), discovered_hazard_cells: count(blocked), newly_discovered_hazard_cells: count(blocked) - priorHazards }
}

export function knownReturnCosts(world, blocked) {
  // Reverse the directed energy cost: walking downhill and uphill differ.
  // Reverse the crossing directions as well. Current Gale crossings are
  // symmetric, but the contract encodes each direction independently.
  let reverseWorld = world
  if (world.layers.passable) {
    const { width: w, height: h } = world.meta
    const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
    const reversed = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) for (let k = 0; k < 8; k++) {
      const [dx, dy] = neighbours[k], x = i % w + dx, y = Math.floor(i / w) + dy
      if (x >= 0 && x < w && y >= 0 && y < h && (world.layers.passable[i] & (1 << k)))
        reversed[y * w + x] |= 1 << (7 - k)
    }
    reverseWorld = { ...world, layers: { ...world.layers, passable: reversed } }
  }
  return costFrom(reverseWorld, world.meta.base_cell, blocked,
    (meta, layers, i, j) => energyCost(meta, layers, j, i)).dist
}

export function routeProfile(world, cells, returnCosts, scale = 1) {
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error('Invalid energy multiplier')
  const { meta, layers } = world
  const reserve = reserveJ(meta)
  let distance = 0, spent = 0
  return cells.map((cell, k) => {
    if (k) {
      distance += meta.cell_size_m * Math.hypot(cell[0] - cells[k - 1][0], cell[1] - cells[k - 1][1])
      spent += stepCost(meta, layers.height, layers.terrain_class, cells[k - 1], cell)
    }
    const nominalReturn = returnCosts[at(meta, cell)]
    const home = nominalReturn < 1e30 ? scale * nominalReturn : Infinity
    const left = meta.energy_budget_j - scale * spent
    return { cell, distance_m: distance, nominal_spent_j: spent, energy_left_j: left,
      return_j: home, margin_after_reserve_j: left - reserve - home }
  })
}

export function aboveFraction(a, b, threshold) {
  // Linear interpolation between grid vertices; distance weighted, not a count
  // of samples. A segment touching an unreachable vertex fails conservatively.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  if (a >= threshold && b >= threshold) return 1
  if (a < threshold && b < threshold) return 0
  return (Math.max(a, b) - threshold) / Math.abs(b - a)
}

export function marginSummary(profile, budget) {
  const threshold = .2 * budget
  let good = 0, feasible = 0
  for (let k = 1; k < profile.length; k++) {
    const [a, b] = [profile[k - 1], profile[k]]
    const distance = b.distance_m - a.distance_m
    good += distance * aboveFraction(a.margin_after_reserve_j, b.margin_after_reserve_j, threshold)
    feasible += distance * aboveFraction(a.margin_after_reserve_j, b.margin_after_reserve_j, 0)
  }
  const worst = profile.reduce((a, b) => a.margin_after_reserve_j <= b.margin_after_reserve_j ? a : b)
  const distance = profile.at(-1).distance_m
  return { minimum_margin_after_reserve_j: worst.margin_after_reserve_j,
    minimum_margin_fraction_of_initial_budget: worst.margin_after_reserve_j / budget,
    minimum_at_cell: worst.cell, minimum_at_distance_m: worst.distance_m,
    distance_m: distance, distance_with_extra_20pct_margin_m: good,
    fraction_distance_with_extra_20pct_margin: distance ? good / distance : null,
    fraction_distance_return_and_reserve_feasible: distance ? feasible / distance : null,
    final_energy_left_j: profile.at(-1).energy_left_j }
}

export function ringStats(meta, costs, nominalSpent, scale = 1) {
  const reserve = reserveJ(meta)
  const limit = meta.energy_budget_j - scale * nominalSpent - reserve
  const normalLimit = meta.energy_budget_j - nominalSpent - reserve
  let cells = 0, nominalCells = 0, gained = 0, lost = 0
  for (const cost of costs) {
    const valid = Number.isFinite(cost) && cost < 1e30
    const inside = valid && scale * cost <= limit
    const normal = valid && cost <= normalLimit
    cells += Number(inside)
    nominalCells += Number(normal)
    gained += Number(inside && !normal)
    lost += Number(normal && !inside)
  }
  return { cells, area_m2: cells * meta.cell_size_m ** 2, gained_cells: gained, lost_cells: lost,
    change_percent_vs_nominal: nominalCells ? 100 * (cells - nominalCells) / nominalCells : null }
}

function measureRoute(world, route, hazards, reviewed, displayed, audit) {
  const nominal = routeProfile(world, route.cells, audit)
  return { stops: route.stops, dropped: route.dropped, cells: route.cells,
    ...describe(world, route.cells),
    all_layer_hazards: hazardContacts(world.meta, route.cells, world.layers.rocks_fine),
    discovered_hazards: hazardContacts(world.meta, route.cells, hazards),
    reviewed_rock_clearance: hazardContacts(world.meta, route.cells, reviewed),
    nominal_margin_audited: marginSummary(nominal, world.meta.energy_budget_j),
    nominal_margin_app_lookup: marginSummary(routeProfile(world, route.cells, displayed), world.meta.energy_budget_j) }
}

export function energySensitivity(world, route, displayedReturn, auditedReturn) {
  const trace = routeProfile(world, route.cells, auditedReturn)
  const snapshots = [0, .25, .5, .75, 1].map((fraction) =>
    trace.find((p) => p.distance_m >= fraction * trace.at(-1).distance_m) ?? trace.at(-1))
  return [.7, 1, 1.3].map((scale) => ({ energy_cost_multiplier: scale,
    margin: marginSummary(routeProfile(world, route.cells, auditedReturn, scale), world.meta.energy_budget_j),
    app_margin: marginSummary(routeProfile(world, route.cells, displayedReturn, scale), world.meta.energy_budget_j),
    ring_snapshots: snapshots.map((p, i) => ({ requested_route_fraction: [0, .25, .5, .75, 1][i],
      cell: p.cell, distance_m: p.distance_m, nominal_spent_j: p.nominal_spent_j,
      app_ring: ringStats(world.meta, displayedReturn, p.nominal_spent_j, scale),
      known_hazards_ring_audit: ringStats(world.meta, auditedReturn, p.nominal_spent_j, scale) })) }))
}

export function repeatScouting(world, targets, flights, reviewed, initial, maxPasses = 10) {
  let route = initial, scanned = null, sample, audit
  const passes = []
  for (let pass = 1; pass <= maxPasses; pass++) {
    sample = simulateScout(world, route, flights, '60fps', scanned)
    scanned = sample.scanned
    const before = hazardContacts(world.meta, route.cells, sample.blocked)
    route = planTour(world, targets, sample.blocked)
    const hidden = hazardContacts(world.meta, route.cells, world.layers.rocks_fine)
    const seen = route.cells.every((c) => scanned[at(world.meta, c)])
    passes.push({ pass, newly_discovered_hazard_cells: sample.newly_discovered_hazard_cells,
      total_discovered_hazard_cells: sample.discovered_hazard_cells,
      previous_route_discovered_hazard_cells: before.unique_cells,
      new_route_all_layer_hazard_cells: hidden.unique_cells, new_route_fully_scanned: seen,
      route_energy_j: route.energy_j, flights: sample.flights, flight_metres: sample.flight_metres })
    if (seen && hidden.unique_cells === 0) break
  }
  audit = knownReturnCosts(world, sample.blocked)
  return { stop_condition: 'All route vertices scanned and zero crossings in the stored hazard layer; at most 10 passes',
    converged: passes.at(-1).new_route_fully_scanned && passes.at(-1).new_route_all_layer_hazard_cells === 0,
    passes, total_flights: passes.reduce((n, p) => n + p.flights, 0),
    total_flight_metres: passes.reduce((n, p) => n + p.flight_metres, 0),
    final_route: measureRoute(world, route, sample.blocked, reviewed, sample.displayedReturn, audit),
    energy_sensitivity: energySensitivity(world, route, sample.displayedReturn, audit) }
}

export function calculate(world, targets, extraFlights, reviewed) {
  const before = planTour(world, targets)
  if (!before.stops.length) throw new Error('Demo route visits no science stops')
  const scout = simulateScout(world, before, extraFlights)
  const after = planTour(world, targets, scout.blocked)
  const home = knownReturnCosts(world, scout.blocked)
  const unblockedHome = knownReturnCosts(world, null)
  const prior = measureRoute(world, before, scout.blocked, reviewed, world.layers.cost_to_go, unblockedHome)
  const updated = measureRoute(world, after, scout.blocked, reviewed, scout.displayedReturn, home)
  const trace = routeProfile(world, after.cells, home)
  const sensitivity = energySensitivity(world, after, scout.displayedReturn, home)
  const sampling = ['30fps', '60fps', '120fps', 'spatial4m'].map((mode) => {
    const sample = mode === '60fps' ? scout : simulateScout(world, before, extraFlights, mode)
    const route = mode === '60fps' ? after : planTour(world, targets, sample.blocked)
    return { mode, scanned_cells: sample.scanned_cells, discovered_hazard_cells: sample.discovered_hazard_cells,
      reviewed_clearance_cells_seen: count(sample.blocked.map((v, i) => v && reviewed[i])),
      before_crossings: hazardContacts(world.meta, before.cells, sample.blocked),
      after_crossings: hazardContacts(world.meta, route.cells, sample.blocked),
      after_all_layer_crossings: hazardContacts(world.meta, route.cells, world.layers.rocks_fine),
      after_energy_j: route.energy_j, stops: route.stops }
  })
  const differences = trace.map((p) => {
    const shown = scout.displayedReturn[at(world.meta, p.cell)], expected = home[at(world.meta, p.cell)]
    return expected - shown
  })
  return { orbit_only: prior, after_scout: updated,
    delta: { energy_j: updated.energy_j - prior.energy_j,
      energy_percent: 100 * (updated.energy_j / prior.energy_j - 1),
      distance_m: updated.metres - prior.metres,
      known_hazard_cells_avoided: prior.discovered_hazards.unique_cells - updated.discovered_hazards.unique_cells },
    scout: { mode: '60fps', flights: scout.flights, flight_metres: scout.flight_metres,
      scanned_cells: scout.scanned_cells, discovered_hazard_cells: scout.discovered_hazard_cells,
      reviewed_clearance_cells_seen: count(scout.blocked.map((v, i) => v && reviewed[i])) },
    sampling_sensitivity: sampling, energy_sensitivity: sensitivity,
    repeated_scout: repeatScouting(world, targets, extraFlights, reviewed, before),
    app_return_lookup_audit: { maximum_underestimate_j_on_route: Math.max(0, ...differences),
      maximum_overestimate_j_on_route: Math.max(0, ...differences.map((v) => -v)) },
    nominal_audited_profile: trace }
}
