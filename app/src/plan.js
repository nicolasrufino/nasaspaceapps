// Route planner for plan mode (the habitat screen, the night before; re-run after the scout flight).
// The walk itself never searches: it only looks up cost_to_go (contract §1).
// Cost = energy (Pandolf at Mars gravity, same as the pipeline), so "best" means least effort, not
// shortest: uphill and sand cost more. Cells steeper than knobs.max_slope_deg, or blocked (rocks the
// scout found), cannot be entered, same rule as data/pipeline/make_world.py.
import { stepCostIdx } from './walk.js'

const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
export const MAX_STOPS = 12 // ponytail: exact order search is 2^k·k²; past ~12 stops switch to a greedy order

// Step costs the search can minimise: walking energy (the default), or plain distance (E5's alternative).
export const energyCost = (meta, layers, i, j) => stepCostIdx(meta, layers.height, layers.terrain_class, i, j)
export const distanceCost = (meta, layers, i, j) =>
  meta.cell_size_m * Math.hypot((i % meta.width) - (j % meta.width), Math.floor(i / meta.width) - Math.floor(j / meta.width))

// Cost (J by default) to walk from `from` to every cell, and the previous cell on that cheapest path (Dijkstra).
export function costFrom({ meta, layers }, from, blocked, cost = energyCost) {
  const { width: W, height: H } = meta
  const dist = new Float64Array(W * H).fill(Infinity)
  const prev = new Int32Array(W * H).fill(-1)
  const s = from[1] * W + from[0]
  dist[s] = 0
  const heap = new Heap()
  heap.push(0, s)
  while (heap.size) {
    const [d, i] = heap.pop()
    if (d > dist[i]) continue
    const x = i % W, y = (i - x) / W
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (layers.slope[j] > meta.knobs.max_slope_deg || blocked?.[j]) continue
      const nd = d + cost(meta, layers, i, j)
      if (nd < dist[j]) {
        dist[j] = nd
        prev[j] = i
        heap.push(nd, j)
      }
    }
  }
  return { dist, prev }
}

// Plan a walk from base through the chosen stops and back to base.
// Visits as many stops as fit in the energy budget with the reserve kept; among those, the least energy.
export function planTour(world, stops, blocked) {
  const { meta } = world
  const W = meta.width
  const at = (c) => c[1] * W + c[0]
  const nodes = [meta.base_cell, ...stops.slice(0, MAX_STOPS).map((s) => s.cell)]
  const runs = nodes.map((c) => costFrom(world, c, blocked))
  const leg = (a, b) => runs[a].dist[at(nodes[b])]
  const k = nodes.length - 1

  // Held-Karp: best[m][j] = least energy from base visiting the stops in mask m, ending at stop j.
  const best = Array.from({ length: 1 << k }, () => new Float64Array(k).fill(Infinity))
  const back = Array.from({ length: 1 << k }, () => new Int8Array(k).fill(-1))
  for (let j = 0; j < k; j++) best[1 << j][j] = leg(0, j + 1)
  for (let m = 1; m < 1 << k; m++) {
    for (let j = 0; j < k; j++) {
      if (!((m >> j) & 1) || best[m][j] === Infinity) continue
      for (let n = 0; n < k; n++) {
        if ((m >> n) & 1) continue
        const c = best[m][j] + leg(j + 1, n + 1)
        if (c < best[m | (1 << n)][n]) {
          best[m | (1 << n)][n] = c
          back[m | (1 << n)][n] = j
        }
      }
    }
  }

  const limit = meta.energy_budget_j * (1 - meta.reserve_fraction)
  let pick = { count: 0, energy: 0, mask: 0, last: -1 }
  for (let m = 1; m < 1 << k; m++) {
    const count = popcount(m)
    for (let j = 0; j < k; j++) {
      const e = best[m][j] + leg(j + 1, 0)
      if (e <= limit && (count > pick.count || (count === pick.count && e < pick.energy))) pick = { count, energy: e, mask: m, last: j }
    }
  }

  const order = []
  for (let m = pick.mask, j = pick.last; j >= 0;) {
    order.unshift(j)
    const pj = back[m][j]
    m &= ~(1 << j)
    j = pj
  }
  const seq = [0, ...order.map((j) => j + 1), 0]
  const cells = [nodes[0]]
  for (let s = 1; s < seq.length; s++) cells.push(...pathCells(runs[seq[s - 1]].prev, W, at(nodes[seq[s]])).slice(1))
  let metres = 0
  for (let s = 1; s < cells.length; s++) metres += meta.cell_size_m * Math.hypot(cells[s][0] - cells[s - 1][0], cells[s][1] - cells[s - 1][1])
  return {
    cells,
    stops: order.map((j) => stops[j].id),
    dropped: stops.filter((_, j) => !order.includes(j)).map((s) => s.id),
    energy_j: pick.energy,
    minutes: metres / meta.knobs.speed_mps / 60, // walking only; time at stops comes with E6
  }
}

export function pathCells(prev, W, to) {
  const out = []
  for (let i = to; i >= 0; i = prev[i]) out.unshift([i % W, (i - (i % W)) / W])
  return out
}

function popcount(m) {
  let c = 0
  for (; m; m &= m - 1) c++
  return c
}

// ponytail: minimal binary min-heap; JS has no priority queue.
class Heap {
  k = []
  v = []
  get size() {
    return this.k.length
  }
  push(key, val) {
    let i = this.k.length
    this.k.push(key)
    this.v.push(val)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.k[p] <= key) break
      this.k[i] = this.k[p]
      this.v[i] = this.v[p]
      i = p
    }
    this.k[i] = key
    this.v[i] = val
  }
  pop() {
    const top = [this.k[0], this.v[0]]
    const key = this.k.pop()
    const val = this.v.pop()
    const n = this.k.length
    if (n) {
      let i = 0
      for (;;) {
        let c = 2 * i + 1
        if (c >= n) break
        if (c + 1 < n && this.k[c + 1] < this.k[c]) c++
        if (this.k[c] >= key) break
        this.k[i] = this.k[c]
        this.v[i] = this.v[c]
        i = c
      }
      this.k[i] = key
      this.v[i] = val
    }
    return top
  }
}
