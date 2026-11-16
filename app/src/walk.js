// Walking core (block E2). All maths on the 2D grid; the 3D view only shows it.
// Energy model mirrors data/pipeline/make_world.py so the drain matches cost_to_go exactly:
// Pandolf (1977) metabolic rate, terrain factor per AI4Mars class, scaled to Mars gravity.

// Terrain factors and the gravity factor come from world.json knobs (make_world.py writes them: knobs.eta,
// knobs.gravity_energy_factor). These fallbacks are the old values, for worlds built before those knobs existed.
export const ETA = [1.2, 1.1, 1.0, 2.1, 1.5] // unknown, soil, bedrock, sand, big rock

const idx = (meta, [x, y]) => y * meta.width + x

// Joules to walk from cell a to neighbour b.
export const stepCost = (meta, height, cls, a, b) => stepCostIdx(meta, height, cls, idx(meta, a), idx(meta, b))

// Same, by cell index (the planner calls this millions of times, so no arrays).
export function stepCostIdx(meta, height, cls, i, j) {
  const w = meta.width
  const dist = meta.cell_size_m * Math.hypot((i % w) - (j % w), Math.floor(i / w) - Math.floor(j / w))
  const grade = (100 * (height[j] - height[i])) / dist
  const { body_kg: W, load_kg: L, speed_mps: V } = meta.knobs
  const etas = meta.knobs.eta ?? ETA
  const eta = etas[cls[j]] ?? etas[0]
  const watts = 1.5 * W + 2 * (W + L) * (L / W) ** 2 + eta * (W + L) * (1.5 * V * V + 0.35 * V * Math.max(grade, 0))
  const g = meta.knobs.gravity_energy_factor ?? meta.gravity_mps2 / 9.81
  return (watts * g * dist) / V
}

export function startWalk(meta) {
  return { t: 0, cell: [...meta.base_cell], energy_left_j: meta.energy_budget_j, inside_ring: true }
}

// Move one cell; returns true when this step crossed the point of no return.
export function stepTo({ meta, layers }, walk, next) {
  walk.energy_left_j -= stepCost(meta, layers.height, layers.terrain_class, walk.cell, next)
  walk.t += (meta.cell_size_m * Math.hypot(next[0] - walk.cell[0], next[1] - walk.cell[1])) / meta.knobs.speed_mps
  walk.cell = next
  const was = walk.inside_ring
  walk.inside_ring = layers.cost_to_go[idx(meta, next)] <= ringLimit(meta, walk)
  return was && !walk.inside_ring
}

// Free walk (Vision's eye level and Follow): walk to app metres (x, z). When that lands in a new 8 m cell, pay the
// step's energy and time exactly as the route walk does. Returns true when this step crossed the point of no return.
export function freeStep(world, walk, x, z) {
  const { meta } = world, cs = meta.cell_size_m
  const cell = [Math.max(0, Math.min(meta.width - 1, Math.round(x / cs))), Math.max(0, Math.min(meta.height - 1, Math.round(z / cs)))]
  if (cell[0] === walk.cell[0] && cell[1] === walk.cell[1]) return false
  return stepTo(world, walk, cell)
}

// The walk-back ring: every cell with cost_to_go <= energy_left - reserve (contract §1).
export const reserveJ = (meta) => meta.reserve_fraction * meta.energy_budget_j
export const ringLimit = (meta, walk) => walk.energy_left_j - reserveJ(meta)

export function ringMask(costToGo, limit) {
  const inside = new Uint8Array(costToGo.length)
  for (let i = 0; i < costToGo.length; i++) inside[i] = costToGo[i] <= limit
  return inside
}

// App state, contract §3. The CAPCOM agent and the walk log read this shape.
export function appState({ meta, layers }, walk) {
  const i = idx(meta, walk.cell)
  return {
    t: walk.t,
    astronaut: { x: walk.cell[0], y: walk.cell[1] },
    energy_left_j: walk.energy_left_j,
    reserve_j: reserveJ(meta),
    cost_to_go_j: layers.cost_to_go[i],
    inside_ring: walk.inside_ring,
    terrain_class: layers.terrain_class[i],
    mode: 'route',
  }
}

// Litres of oxygen the energy left stands for (kj_per_l_o2 in world.json).
export const oxygenL = (meta, energyJ) => Math.max(energyJ, 0) / 1000 / meta.kj_per_l_o2
