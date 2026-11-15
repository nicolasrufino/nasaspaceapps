// "Why this route" (block E5): explains the planned route with numbers from the site files.
// No new decisions here: it measures the route the planner chose and the alternative it beat.
import { stepCostIdx } from './walk.js'
import { costFrom, distanceCost, pathCells } from './plan.js'

const SAND = 3 // terrain class (AI4Mars order)

// Cut the route at each stop (in visiting order): base → stop 1 → … → base.
export function stretches(route, stopCells) {
  const ends = []
  let k = 0
  for (const [x, y] of stopCells) {
    while (k < route.cells.length - 1 && !(route.cells[k][0] === x && route.cells[k][1] === y)) k++
    ends.push(k)
  }
  ends.push(route.cells.length - 1)
  let start = 0
  return ends.map((e) => {
    const part = route.cells.slice(start, e + 1)
    start = e
    return part
  })
}

// Distance, energy, time, steepest slope, share of sand and rock cells for a run of cells.
export function describe({ meta, layers }, cells, blocked) {
  const W = meta.width
  const at = ([x, y]) => y * W + x
  let metres = 0, energy = 0, steepest = 0, sand = 0, rocks = 0, climb = 0
  cells.forEach((c, k) => {
    const i = at(c)
    steepest = Math.max(steepest, layers.slope[i])
    sand += layers.terrain_class[i] === SAND
    rocks += blocked?.[i] ? 1 : 0
    if (!k) return
    const p = cells[k - 1]
    metres += meta.cell_size_m * Math.hypot(c[0] - p[0], c[1] - p[1])
    climb += Math.max(0, layers.height[i] - layers.height[at(p)])
    energy += stepCostIdx(meta, layers.height, layers.terrain_class, at(p), i)
  })
  return { metres, energy_j: energy, minutes: metres / meta.knobs.speed_mps / 60, steepest_deg: steepest,
    sand_share: cells.length ? sand / cells.length : 0, rock_cells: rocks, climb_m: climb }
}

// The tightest moment of the walk: least energy to spare after the way home and the reserve.
export function lowestMargin({ meta, layers }, cells, ctg) {
  const reserve = meta.reserve_fraction * meta.energy_budget_j
  let left = meta.energy_budget_j
  let low = { margin_j: Infinity, index: 0 }
  cells.forEach((c, k) => {
    if (k) left -= stepCostIdx(meta, layers.height, layers.terrain_class, cells[k - 1][1] * meta.width + cells[k - 1][0], c[1] * meta.width + c[0])
    const m = left - reserve - ctg[c[1] * meta.width + c[0]]
    if (m < low.margin_j) low = { margin_j: m, index: k }
  })
  return low
}

// The route a person would draw: the shortest distance through the same stops in the same order.
export function shortestAlternative(world, stopCells, blocked) {
  const { meta } = world
  const nodes = [meta.base_cell, ...stopCells, meta.base_cell]
  const cells = [nodes[0]]
  for (let k = 1; k < nodes.length; k++) {
    const { prev } = costFrom(world, nodes[k - 1], blocked, distanceCost)
    cells.push(...pathCells(prev, meta.width, nodes[k][1] * meta.width + nodes[k][0]).slice(1))
  }
  return cells
}
