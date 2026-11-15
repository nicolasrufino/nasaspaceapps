// A6: experimental remote-sensing value of information. Never reads rocks_fine.
// Ports scan/choose/execWalk from docs/scouting/explainer.html to contract worlds.
// The belief weights are NOT calibrated ground-truth probabilities; keep voi off
// unless its benchmark promotion gate passes. See app/scripts/VOI.md.
import { beliefMap, featureColumns } from './belief.js'
import { canStep } from './plan.js'
import { stepCostIdx } from './walk.js'
import { nextRouteFlight, scanFlight, pathMetres, MAX_FLIGHTS, FLIGHT_M } from './scout.js'

const NB = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
export const VOI_DEFAULTS = { samples: 12, candidates: 3, strip_m: 500, min_gain_j: 1000,
  spread_multiplier: 2, risk_weight: 4, seed: 138 }

export function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}

class Heap {
  a = []
  push(value) {
    let i = this.a.length; this.a.push(value)
    while (i > 0) { const p = (i - 1) >> 1; if (this.a[p][0] <= value[0]) break; this.a[i] = this.a[p]; i = p }
    this.a[i] = value
  }
  pop() {
    const first = this.a[0], last = this.a.pop(); let i = 0
    if (this.a.length) {
      while (2 * i + 1 < this.a.length) {
        let c = 2 * i + 1
        if (c + 1 < this.a.length && this.a[c + 1][0] < this.a[c][0]) c++
        if (this.a[c][0] >= last[0]) break
        this.a[i] = this.a[c]; i = c
      }
      this.a[i] = last
    }
    return first
  }
}

// Targeted A*: same directed crossings and step costs as costFrom; an admissible
// lower bound is the smallest edge energy per grid unit. Cached for all rollouts.
export function makeSearch(world, riskWeight = VOI_DEFAULTS.risk_weight) {
  const { meta, layers } = world, W = meta.width, H = meta.height, N = W * H
  const edges = new Int32Array(N * 8).fill(-1), costs = new Float64Array(N * 8)
  let minUnit = Infinity
  for (let i = 0; i < N; i++) for (let k = 0; k < 8; k++) {
    const [dx, dy] = NB[k], x = i % W + dx, y = Math.floor(i / W) + dy
    if (x < 0 || y < 0 || x >= W || y >= H) continue
    const j = y * W + x
    if (!canStep(meta, layers, i, k, j)) continue
    const c = stepCostIdx(meta, layers.height, layers.terrain_class, i, j)
    edges[i * 8 + k] = j; costs[i * 8 + k] = c
    minUnit = Math.min(minUnit, c / Math.hypot(dx, dy))
  }
  if (!Number.isFinite(minUnit)) minUnit = 0
  const heuristic = (i, goal) => minUnit * Math.hypot(i % W - goal % W, Math.floor(i / W) - Math.floor(goal / W))
  return (start, goal, known, p, mult) => {
    if (known[start] === 1 || known[goal] === 1) return null
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = new Heap()
    dist[start] = 0; heap.push([heuristic(start, goal), start, 0])
    while (heap.a.length) {
      const [, i, g] = heap.pop()
      if (g !== dist[i]) continue
      if (i === goal) {
        const cells = []
        for (let j = i; j >= 0; j = prev[j]) cells.push(j)
        return cells.reverse()
      }
      for (let k = 0; k < 8; k++) {
        const j = edges[i * 8 + k]
        if (j < 0 || known[j] === 1) continue
        const risk = known[j] === -1 ? Math.min(.95, p[j]) : 0
        const d = g + costs[i * 8 + k] * (mult?.[j] ?? 1) * (1 + riskWeight * risk / (1 - risk))
        if (d < dist[j]) { dist[j] = d; prev[j] = i; heap.push([d + heuristic(j, goal), j, d]) }
      }
    }
    return null
  }
}

// Spatially correlated 2x2-cell patches share a draw; observed cells are clamped.
// This is a sampling assumption, not a learned correlation length on Mars.
export function sampleWorlds(meta, known, p, count, seed) {
  const rand = random(seed), W = meta.width, H = meta.height, out = []
  for (let s = 0; s < count; s++) {
    const truth = new Uint8Array(W * H)
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const u = rand()
      for (let dy = 0; dy < 2 && y + dy < H; dy++) for (let dx = 0; dx < 2 && x + dx < W; dx++) {
        const i = (y + dy) * W + x + dx
        truth[i] = known[i] === -1 ? +(u < p[i]) : known[i]
      }
    }
    out.push(truth)
  }
  return out
}

// Counterfactual walker sees its neighbours BEFORE entering a blocked cell, then
// repairs the path. Failed/guard-limited runs are retained with a stated penalty.
export function execWalk(world, nodes, truth, initialKnown, p, search) {
  const { meta, layers } = world, W = meta.width, H = meta.height, N = W * H
  const known = Int8Array.from(initialKnown), penalty = 4 * meta.energy_budget_j
  let pos = nodes[0], cost = 0, steps = 0, repairs = 0
  const reveal = (i) => {
    const fresh = []
    for (const [dx, dy] of [[0, 0], ...NB]) {
      const x = i % W + dx, y = Math.floor(i / W) + dy
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const j = y * W + x
      if (known[j] === -1) { known[j] = truth[j]; if (truth[j]) fresh.push(j) }
    }
    return fresh
  }
  reveal(pos)
  for (const goal of nodes.slice(1)) {
    while (pos !== goal) {
      if (++repairs > 80 || steps > N * 2) return { cost_j: penalty, completed: false }
      const path = search(pos, goal, known, p)
      if (!path) return { cost_j: penalty, completed: false }
      let changed = false
      for (let k = 1; k < path.length; k++) {
        if (known[path[k]] === 1) { changed = true; break }
        cost += stepCostIdx(meta, layers.height, layers.terrain_class, pos, path[k])
        pos = path[k]; steps++
        const fresh = reveal(pos)
        if (fresh.length && path.slice(k + 1).some((i) => known[i] === 1)) { changed = true; break }
      }
      if (!changed && pos !== goal) return { cost_j: penalty, completed: false }
    }
  }
  return { cost_j: cost, completed: true }
}

export function candidateRoutes(world, nodes, known, p, search, count = 3) {
  const routes = [], N = known.length
  for (let leg = 1; leg < nodes.length; leg++) {
    const mult = new Float32Array(N).fill(1), unique = new Set()
    for (let k = 0; k < count; k++) {
      const path = search(nodes[leg - 1], nodes[leg], known, p, mult)
      if (!path) break
      const key = path.join(',')
      if (!unique.has(key)) { unique.add(key); routes.push({ leg, path }) }
      for (const i of path) mult[i] *= 1.9
    }
  }
  return routes
}

export function createVoiContext(world, options = {}) {
  const config = { ...VOI_DEFAULTS, ...options }
  return { config, search: makeSearch(world, config.risk_weight), columns: featureColumns(world) }
}

export function chooseVoi(world, scout, context = createVoiContext(world)) {
  const t0 = performance.now(), { config, search, columns } = context
  const { meta } = world, W = meta.width, N = W * meta.height
  const at = ([x, y]) => y * W + x, xy = (i) => [i % W, Math.floor(i / W)]
  const stop = (reason, extra = {}) => ({ flight: null, reason, ...extra, compute_ms: performance.now() - t0 })
  if (scout.flights.length >= Math.min(MAX_FLIGHTS, scout.maxFlights)) return stop('Three-flight budget used.')
  if (!scout.route.stops.length) return stop('No science route to inspect.')
  const known = Int8Array.from(scout.scanned, (v, i) => v ? +(!!scout.blocked[i]) : -1)
  const p = beliefMap(world, scout.scanned, scout.blocked, undefined, columns)
  const stops = scout.route.stops.map((id) => scout.targets.find((s) => s.id === id))
  const nodes = [at(meta.base_cell), ...stops.map((s) => at(s.cell)), at(meta.base_cell)]
  const samples = sampleWorlds(meta, known, p, config.samples, config.seed + scout.flights.length * 101)
  const now = samples.map((truth) => execWalk(world, nodes, truth, known, p, search))
  const routes = candidateRoutes(world, nodes, known, p, search, config.candidates)
  const strips = [], unique = new Set()
  for (const candidate of routes) {
    const cells = candidate.path.map(xy), local = Uint8Array.from(scout.scanned)
    // Include successive unseen strips from each alternative, not unrelated anomalies.
    const maxStrips = Math.ceil(pathMetres(meta, cells) / Math.min(config.strip_m, scout.flightLimit, FLIGHT_M)) + 1
    for (let k = 0; k < maxStrips; k++) {
      const flight = nextRouteFlight(meta, cells, local, Math.min(config.strip_m, scout.flightLimit, FLIGHT_M))
      if (!flight) break
      const footprint = new Uint8Array(N)
      scanFlight(meta, footprint, { ...flight })
      const fresh = []
      footprint.forEach((v, i) => { if (v) { local[i] = 1; if (!scout.scanned[i]) fresh.push(i) } })
      const key = fresh.join(',')
      if (!fresh.length || unique.has(key)) continue
      unique.add(key)
      const after = samples.map((truth) => {
        const seen = Int8Array.from(known)
        for (const i of fresh) seen[i] = truth[i]
        return execWalk(world, nodes, truth, seen, p, search)
      })
      const gains = now.map((v, i) => v.cost_j - after[i].cost_j)
      const gain = gains.reduce((a, b) => a + b, 0) / gains.length
      const se = gains.length > 1 ? Math.sqrt(gains.reduce((a, b) => a + (b - gain) ** 2, 0) / (gains.length - 1) / gains.length) : Infinity
      strips.push({ ...flight, destination: stops[candidate.leg - 1]?.name ?? 'Base',
        kind: 'value of information (experimental)', expected_gain_j: gain, sample_se_j: se,
        score_j_per_m: gain / flight.metres, fresh_cells: fresh.length,
        failed_samples_after: after.filter((v) => !v.completed).length })
    }
  }
  const beforeFailures = now.filter((v) => !v.completed).length
  strips.sort((a, b) => b.score_j_per_m - a.score_j_per_m)
  // A minimum gain and a sampling-spread heuristic; NOT a confidence guarantee.
  const flight = strips.find((s) => s.expected_gain_j > Math.max(config.min_gain_j, config.spread_multiplier * s.sample_se_j)
    && s.failed_samples_after <= beforeFailures) ?? null
  const result = { candidate_routes: routes.length, candidate_strips: strips.length, samples: samples.length,
    failed_samples_before: beforeFailures, expected_cost_before_j: now.reduce((a, b) => a + b.cost_j, 0) / now.length,
    best_gain_j: Math.max(0, ...strips.map((s) => s.expected_gain_j)), compute_ms: performance.now() - t0 }
  return { flight, reason: flight ? 'Best estimated gain per metre above the sampling-spread threshold.'
    : 'No strip clears the estimated-value threshold; unscouted ground may remain.', ...result }
}
