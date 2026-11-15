// Hazards view (ticket F6): what stops a person on foot, in one view with a legend.
// Slope from the 8 m grid (USGS MSL Gale DEM), blocked steps from the 1 m check (crossings_blocked.json,
// data/pipeline/topo_overlay.py), reviewed rocks (ROSCO + human review, reviewed_rocks.json) and the
// orbit-estimated rocks in rocks_fine that the helicopter has not looked at yet. Draws only; plans nothing.

export const SLOPE_WARN_DEG = 15

export const COLORS = {
  ok: [70, 170, 90], // walkable slope
  warn: [235, 170, 40], // within 5 deg of the limit
  steep: [215, 45, 40], // over the limit
  estimate: [120, 30, 30], // orbit-estimated rocks: hatched with the slope colour
  seen: [200, 35, 35], // rocks the helicopter has seen
  blocked: 0xff2d2d, // blocked-step edges (3D lines)
  reviewed: 0xffffff, // reviewed-rock pins
}

const css = ([r, g, b]) => `rgb(${r},${g},${b})`
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

// One colour per cell (row 0 north). reviewed: Uint8Array mask of the reviewed rocks' clearance cells.
export function hazardRGB(world, scanned, reviewed = null) {
  const { meta, layers } = world
  const { width: W, height: H } = meta
  const limit = meta.knobs?.max_slope_deg ?? 20
  const out = new Uint8Array(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    const s = layers.slope[i]
    let c = s > limit ? COLORS.steep : s > SLOPE_WARN_DEG ? COLORS.warn : COLORS.ok
    if (layers.rocks_fine?.[i]) {
      if (scanned?.[i]) c = COLORS.seen
      else if (!reviewed?.[i] && ((i % W) + Math.floor(i / W)) % 2 === 0) c = COLORS.estimate // hatched: unconfirmed
    }
    out.set(c, i * 3)
  }
  return out
}

// Line segments for the blocked steps: a short wall across each crossing, at its midpoint.
// crossings: crossings_blocked.json "crossings" rows [x, y, dir, reason, step_m, run_m, mid_x, mid_y, mid_z, near].
// heightAt(x, z): the drawn terrain's height there, so the walls sit on the mesh; lift keeps them above it.
export const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
export function blockedSegments(crossings, heightAt, half = 3, lift = 0.8) {
  const out = new Float32Array(crossings.length * 6)
  crossings.forEach(([, , d, , , , mx, mz, my], k) => {
    const [dx, dy] = NB[d]
    const len = Math.hypot(dx, dy)
    const px = (-dy / len) * half, pz = (dx / len) * half // across the crossing
    const y = Math.max(my, heightAt(mx, mz)) + lift
    out.set([mx - px, y, mz - pz, mx + px, y, mz + pz], k * 6)
  })
  return out
}

// Mask of the reviewed rocks' clearance cells (one cell around each point, as in rocks_fine).
export function reviewedMask(points, W, H) {
  const m = new Uint8Array(W * H)
  for (const { cell: [x, y] } of points) {
    for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) if (i >= 0 && j >= 0 && i < W && j < H) m[j * W + i] = 1
  }
  return m
}

export function legendHTML(meta, { blocked = 0, reviewed = 0 } = {}) {
  const limit = meta.knobs?.max_slope_deg ?? 20
  const step = meta.knobs?.step_max_m ?? 0.3
  const run = meta.knobs?.steep_run_m ?? 3
  const sw = (c) => `<i style="background:${c}"></i>`
  const hatch = `<i style="background:repeating-linear-gradient(45deg,${css(COLORS.estimate)} 0 3px,${css(COLORS.ok)} 3px 6px)"></i>`
  return `<b>Hazards</b>
<ul>
<li>${sw(css(COLORS.ok))}Slope under ${SLOPE_WARN_DEG}°: walkable</li>
<li>${sw(css(COLORS.warn))}Slope ${SLOPE_WARN_DEG}–${limit}°: near the limit</li>
<li>${sw(css(COLORS.steep))}Slope over ${limit}°: too steep (NASA xEVA limit)</li>
<li>${sw(hex(COLORS.blocked))}Blocked step (${blocked}): looks walkable at 8 m, but the 1 m terrain has a ledge over ${step} m or a run steeper than ${limit}° for ${run} m or more</li>
<li>${sw(hex(COLORS.reviewed))}Reviewed rock (${reviewed}): ROSCO detection a person confirmed</li>
<li>${hatch}Orbit estimate: rocks guessed from terrain roughness, not yet confirmed</li>
<li>${sw(css(COLORS.seen))}Rock the helicopter has seen</li>
</ul>
<small>Darker ground is outside the walk-back ring. Slope: 8 m cells, USGS MSL Gale DEM (MRO HiRISE stereo). Steps: 1 m terrain, same source. The route never crosses a red wall; it goes around rocks once they are confirmed.</small>`
}
