// Eye-level walk for Vesta Vision (issue #208, flag eye_walk): stand on the real Gale terrain and walk with WASD or
// the arrow keys (Shift runs), drag to look, and follow a red guide line along the planned route to each stop.
// A label names the next stop and its distance. No energy read-outs here on purpose. On a phone, four on-screen
// arrows do what the keys do. This file holds the movement and the label; main.js owns the camera and the scene.

export const REACH_M = 8 // within this distance a stop counts as reached
export const RUN = 6 // Shift: faster than a person, for the demo

// One frame of movement. yaw as the camera uses it (0 looks north, -z); keys: { f, b, l, r } each 0 or 1.
// Returns the new [x, z], kept inside [0, max].
export function moveStep([x, z], yaw, keys, dt, speed, [maxX, maxZ]) {
  const fwd = keys.f - keys.b, side = keys.r - keys.l
  if (!fwd && !side) return [x, z]
  const n = Math.hypot(fwd, side), d = (speed * dt) / n
  const nx = x + (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * d
  const nz = z + (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * d
  return [Math.max(0, Math.min(maxX, nx)), Math.max(0, Math.min(maxZ, nz))]
}

// The stop to head for: the first one in route order not yet reached. Marks a stop reached when within REACH_M.
// stops: [{ id, name, x, z }] in route order; reached: Set of ids (updated). Returns { next, metres, justReached }.
export function nextTarget([x, z], stops, reached) {
  let justReached = null
  for (const s of stops) {
    if (reached.has(s.id)) continue
    const metres = Math.hypot(s.x - x, s.z - z)
    if (metres <= REACH_M) { reached.add(s.id); justReached = s; continue }
    return { next: s, metres, justReached }
  }
  return { next: null, metres: 0, justReached }
}

// A flat ribbon along a line of points [x, y, z], `width` metres wide: positions and triangle indices.
export function ribbon(points, width) {
  const pos = new Float32Array(points.length * 6), idx = []
  points.forEach(([x, y, z], i) => {
    const [ax, , az] = points[Math.max(0, i - 1)], [bx, , bz] = points[Math.min(points.length - 1, i + 1)]
    const len = Math.hypot(bx - ax, bz - az) || 1, px = (-(bz - az) / len) * width / 2, pz = ((bx - ax) / len) * width / 2
    pos.set([x - px, y, z - pz, x + px, y, z + pz], i * 6)
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i)
  })
  return { pos, idx }
}

const KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' }

export function initEyeWalk({ speed, max }) {
  const keys = { f: 0, b: 0, l: 0, r: 0 }
  let run = false, on = false, pos = [0, 0], reachedAt = 0, reachedName = ''
  const reached = new Set()
  const label = Object.assign(document.createElement('div'), { id: 'eyeLabel', hidden: true })
  label.setAttribute('role', 'status')
  label.style.cssText = 'position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:6;max-width:min(92vw,520px);padding:8px 14px;border-radius:10px;background:#141a22e6;color:#fff;font:600 15px system-ui,sans-serif;text-align:center;pointer-events:none'
  const pad = Object.assign(document.createElement('div'), { id: 'eyePad', hidden: true })
  pad.style.cssText = 'position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));z-index:6;display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,48px);gap:4px;touch-action:none'
  for (const [k, text, col, row, name] of [['f', '▲', 2, 1, 'Walk forward'], ['l', '◀', 1, 2, 'Step left'], ['b', '▼', 2, 2, 'Walk back'], ['r', '▶', 3, 2, 'Step right']]) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text })
    b.setAttribute('aria-label', name)
    b.style.cssText = `grid-column:${col};grid-row:${row};border-radius:10px;border:1px solid #fff5;background:#141a22e6;color:#fff;font:600 18px system-ui,sans-serif;touch-action:none`
    const set = (v) => (e) => { e.preventDefault(); keys[k] = v }
    b.addEventListener('pointerdown', set(1)); b.addEventListener('pointerup', set(0)); b.addEventListener('pointerleave', set(0)); b.addEventListener('pointercancel', set(0))
    pad.append(b)
  }
  document.body.append(label, pad)
  const key = (v) => (e) => {
    if (!on || e.target.closest?.('input, textarea, select')) return
    if (e.key === 'Shift') { run = !!v; return }
    const k = KEYS[e.key.toLowerCase()]
    if (k) { keys[k] = v; e.preventDefault() }
  }
  addEventListener('keydown', key(1))
  addEventListener('keyup', key(0))
  addEventListener('blur', () => { keys.f = keys.b = keys.l = keys.r = 0; run = false })

  return {
    place(x, z) { pos = [x, z] }, // start from where the astronaut stands
    show(v) { on = v; label.hidden = pad.hidden = !v; if (!v) keys.f = keys.b = keys.l = keys.r = 0 },
    restart() { reached.clear(); reachedAt = 0 }, // a new plan: every stop is ahead again
    // One frame: move, then say where to go. Returns [x, z] for the camera.
    tick(dt, yaw, stops, now = performance.now()) {
      pos = moveStep(pos, yaw, keys, dt, speed * (run ? RUN : 1), max)
      const t = nextTarget(pos, stops, reached)
      if (t.justReached) { reachedAt = now; reachedName = t.justReached.name }
      const head = now - reachedAt < 4000 && reachedName ? `Reached ${reachedName}. ` : ''
      label.textContent = t.next ? `${head}Next: ${t.next.name} · ${Math.round(t.metres)} m`
        : stops.length ? `${head}All ${stops.length} stops reached. Follow the red line home.` : 'No stops planned: pick stops in the Map view.'
      return pos
    },
  }
}
