// Deterministic benchmark fixtures, not NASA observations or training labels.
import { random } from '../src/scout-voi.js'

export function generatedWorld(seed) {
  const W = 32, H = 32, N = W * H, cs = 8, rand = random(seed)
  const meta = { width: W, height: H, cell_size_m: cs, base_cell: [2, 2],
    energy_budget_j: 2000000, reserve_fraction: .4, gravity_mps2: 3.71,
    knobs: { body_kg: 75, load_kg: 60, speed_mps: 1, max_slope_deg: 20, gravity_energy_factor: .68 } }
  const height = new Float32Array(N), slope = new Float32Array(N), terrain = new Uint8Array(N), unsure = new Float32Array(N)
  const phase = rand() * 6, phase2 = rand() * 6
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    height[i] = 6 * Math.sin(x / 5 + phase) + 7 * Math.cos(y / 6 + phase2) + 3 * Math.sin((x + y) / 4)
    terrain[i] = rand() < .12 ? 3 : 1
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    const dx = (height[y * W + Math.min(W - 1, x + 1)] - height[y * W + Math.max(0, x - 1)]) / (2 * cs)
    const dy = (height[Math.min(H - 1, y + 1) * W + x] - height[Math.max(0, y - 1) * W + x]) / (2 * cs)
    slope[i] = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI
    unsure[i] = Math.max(0, slope[i] - 8) / 12
  }
  const rocks = new Uint8Array(N)
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const u = rand()
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = (y + dy) * W + x + dx
      // Independent, specified generator; not a copy of the fitted belief weights.
      rocks[i] = +(u < .005 + .08 * (slope[i] / 20) ** 2 + .05 * unsure[i])
    }
  }
  const targets = [[12,4],[26,10],[24,26],[8,24],[16,16]].map((cell, k) => ({ id: `sample-${k + 1}`, name: `Sample ${k + 1}`, cell }))
  for (const [x, y] of [meta.base_cell, ...targets.map((s) => s.cell)]) rocks[y * W + x] = 0
  return { world: { meta, layers: { height, slope, terrain_class: terrain, rocks_fine: rocks, unsure,
    cost_to_go: new Float32Array(N), cost_to_go_scouted: new Float32Array(N) } }, targets }
}
