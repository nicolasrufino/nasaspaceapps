// Stage 2, How the route is found (docs/UX-PLAN.md section 0): a five-step explainer on the user's own stops.
// The user moves with Next and Back; nothing advances by itself. Each step changes one thing on the 2D map
// (NASA MRO HiRISE picture; slope from the HiRISE stereo terrain) and says at most two sentences in the rail.
// show(step) clears this stage's layers and redraws the whole picture for that step, animating only the newest
// layer, so Back restores the previous picture exactly. Every number is read from `app` when the stage opens.
import { MODELS } from './models.js'

const SVG = 'http://www.w3.org/2000/svg'
const NEAR = 12 // cells either side of the route that get the hidden-rock estimate
const RED = '#ff5a3d', AMBER = '#ffaa28', SCOUT = '#e3dfd3', GREEN = '#46aa5a'
const AMBER_RGB = [255, 170, 40]
const LAYERS = ['fa-straight', 'fa-band', 'fa-centre', 'fa-route'] // map.line layers owned by this stage
const CSS = `
.fa-wrap { display: flex; flex-direction: column; gap: 14px; }
.fa-count { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--mute); }
.fa-prog { display: flex; gap: 6px; margin-top: 8px; }
.fa-prog button { all: unset; flex: 1; min-height: 44px; display: grid; place-items: center; background: var(--panel2); border-radius: 8px; cursor: pointer; color: var(--mute); font-weight: 700; }
.fa-prog button.done { color: var(--paper); } .fa-prog button.now { background-color: var(--paper); color: var(--ink); }
.fa-prog button:focus-visible { outline: 2px solid var(--scout); outline-offset: -4px; }
.fa-text p { font-size: 15px; line-height: 1.45; }
.fa-fade { transition: opacity .5s; }
.fa-route { margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--panel2); }
.fa-route .f-item { padding: 5px 0; border: 0; min-height: 0; }
.fa-route .f-item .n.h { background: #fff; }
@media (max-width: 760px) { .fa-route { display: none; } }
@keyframes fa-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .15 } }
.fa-pulse { animation: fa-pulse 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .fa-pulse { animation: none; } }
`
const span = (color, text) => `<span style="color:${color};font-weight:700">${text}</span>`
const metres = (m) => `${Math.round(m)} m`
const km = (m) => (m >= 1000 ? `${+(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

export default {
  enter(ui, app) {
    const { map } = ui
    const { W, H, cs } = app
    if (!document.getElementById('fa-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'fa-style', textContent: CSS }))
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches

    // ---- Read the plan once: nothing in this stage changes the route. ----
    const route = app.route()
    const cells = route.cells ?? []
    const base = app.meta.base_cell
    const all = app.stops()
    const ordered = (route.stops ?? []).map((id) => all.find((s) => s.id === id)).filter(Boolean)
    const others = all.filter((s) => s.included && !ordered.includes(s)) // included but not on the route (dropped)
    const limit = app.maxSlopeDeg
    const slope = app.world.layers.slope
    const stepM = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) * cs

    // Step 1: straight lines base -> stops in route order -> base, and the steps of it that end on too-steep ground.
    const corners = [base, ...ordered.map((s) => s.cell), base]
    const straight = []
    for (let k = 1; k < corners.length; k++) { const leg = app.line(corners[k - 1], corners[k]); straight.push(...(k > 1 ? leg.slice(1) : leg)) }
    // Contiguous stretches of path cells that pass `bad`, each starting with the cell stepped from; and their length.
    function stretches(path, bad) {
      const runs = []
      let m = 0, run = null
      for (let n = 1; n < path.length; n++) {
        const [x, y] = path[n]
        if (bad(y * W + x)) { m += stepM(path[n - 1], path[n]); if (!run) runs.push((run = [path[n - 1]])); run.push(path[n]) } else run = null
      }
      return { runs, m }
    }
    const steep = stretches(straight, (i) => slope[i] > limit)
    // Step 4: route ground no helicopter has looked at.
    const unseen = stretches(cells, (i) => !app.scanned[i])
    // Step 3: the numbers, from the planner.
    const d = cells.length > 1 ? app.describe(cells) : { metres: 0, energy_j: 0, minutes: 0 }
    const numbers = [['metres', `${Math.round(d.metres)}`], ['kJ', ui.kj(route.energy_j ?? d.energy_j)], ['minutes', `${Math.round(route.minutes ?? d.minutes)}`]]
    const left = app.scout.left()

    // Worked out the first time they are needed (they cost a pass over the map).
    let hazard = null, belief = null, flight
    const getHazard = () => (hazard ??= app.hazardColors())
    function getBelief() { // { near: 1 within NEAR cells of the route, b: chance per cell, max: strongest chance near the route }
      if (belief) return belief
      const near = new Uint8Array(W * H), b = app.belief()
      for (const [x, y] of cells) for (let yy = Math.max(0, y - NEAR); yy <= Math.min(H - 1, y + NEAR); yy++) for (let xx = Math.max(0, x - NEAR); xx <= Math.min(W - 1, x + NEAR); xx++) near[yy * W + xx] = 1
      let max = 0
      for (let i = 0; i < W * H; i++) if (near[i] && b[i] > max) max = b[i]
      return (belief = { near, b, max })
    }
    function getFlight() { // the first flight the scout would fly, or null
      if (flight === undefined) { try { flight = app.scout.preview() ?? null } catch { flight = null } }
      return flight?.waypoints?.length > 1 ? flight : null
    }

    // ---- The steps: title (six words at most), two sentences, what Next is called. ----
    const STEPS = [
      { title: 'A straight line is not enough', next: 'Terrain',
        text: () => [steep.m > 0
          ? `Straight lines cross ${span(RED, metres(steep.m))} above the ${span(RED, `${limit}° suit limit`)}. The route needs to go around.`
          : 'These straight lines stay walkable, but ignore the energy each step costs.'] },
      { title: 'Read the terrain', next: 'Your route',
        text: () => ['HiRISE height data reveals the slopes. Slope and ground type determine walking energy.'],
        small: () => `${span(GREEN, 'Walkable')} · ${span(AMBER, 'near the limit')} · ${span(RED, 'too steep')}` },
      { title: 'Your route from orbit', next: 'Hidden hazards',
        text: () => [app.objective() === 'shortest' ? 'The shortest walkable route through your stops, based on orbit data.' : 'The least-energy route avoids steep ground and sand, based on orbit data.'] },
      { title: 'Check the unknowns', next: 'Flight plan',
        text: () => [`Orbit sees rocks down to about 1.5 m. ${span('#fff', metres(unseen.m))} of this route has never been seen up close.`],
        small: () => `${span(AMBER, 'Amber')}: where smaller rocks are more likely to hide. An experimental estimate.`,
        models: [MODELS.rockChance, MODELS.rockReview] },
      { title: 'Ready to scout',
        text: () => [getFlight()
          ? `Up to ${left} ${left === 1 ? 'flight' : 'flights'} of ${km(app.scout.flightM)}, each seeing a ${span(SCOUT, `${Math.round(2 * app.scout.swathM)} m strip`)}. After each landing the route is planned again with what was found.`
          : `No flight is planned from here: ${left <= 0 ? 'the helicopter has no flights left' : 'there is no unseen route ground in reach'}. The route stands as orbit gave it.`],
        detail: () => 'Planning with unknown blockages is known as the Canadian Traveller Problem.' },
    ]

    // ---- Rail and foot: built once, filled by show(). ----
    const wrap = ui.h('div', 'fa-wrap')
    const head = ui.h('div'), count = ui.h('div', 'fa-count'), prog = ui.h('div', 'fa-prog')
    const segs = STEPS.map((s, k) => { const b = ui.h('button'); b.type = 'button'; b.textContent = k + 1; b.title = s.title; b.setAttribute('aria-label', `Step ${k + 1}: ${s.title}`); b.onclick = () => show(k); prog.append(b); return b })
    head.append(count, prog)
    const body = ui.h('div', 'fa-wrap')
    // Your route, under every step (desktop only; the pins carry the numbers on a phone): the stops in walking
    // order, and from step 3 the route's energy against what may be spent walking (budget minus reserve).
    const card = ui.section('Your route'), legs = ui.h('div', 'f-list'), energy = ui.h('div'), bar = ui.bar(), eText = ui.h('p', 'dim')
    card.classList.add('fa-route')
    const home = () => { const r = ui.item({ n: 'H', title: 'Habitat' }); r.firstChild.classList.add('h'); return r }
    legs.append(home(), ...ordered.map((s, n) => ui.item({ n: n + 1, title: s.name })), home())
    if (others.length) legs.append(ui.h('p', 'dim', `Not on the route: ${others.map((s) => s.name).join(', ')}`))
    const routeJ = route.energy_j ?? d.energy_j
    bar.set(routeJ / app.usableJ)
    eText.textContent = `${ui.kj(routeJ)} of the ${ui.kj(app.usableJ)} kJ you can spend walking. The reserve is kept apart.`
    energy.append(bar.el, eText)
    card.append(legs, energy)
    wrap.append(head, body, card)
    ui.body.append(wrap)

    const note = ui.h('div', 'f-small'), row = ui.h('div', 'f-row')
    const backBtn = ui.button('Back', () => show(step - 1))
    const nextBtn = ui.button('', () => (step === STEPS.length - 1 ? ui.go('scout') : show(step + 1)), true)
    backBtn.style.flex = '0 0 84px'
    row.append(backBtn, nextBtn)
    ui.foot.append(note, row)

    const chip = ui.chip()
    chip.append(ui.stats(numbers.map(([label, value]) => [label, value])).el)

    // ---- Map drawing owned by this stage: two SVG paths (several stretches each) beside the map's named layers. ----
    const path = (color) => { const p = document.createElementNS(SVG, 'path'); for (const [k, v] of Object.entries({ fill: 'none', stroke: color, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) p.setAttribute(k, v); return p }
    const dOf = (runs) => runs.map((r) => `M${r.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join('L')}`).join('')
    const steepEl = path(RED), unseenEl = path('#fff')
    steepEl.setAttribute('d', dOf(steep.runs)); unseenEl.setAttribute('d', dOf(unseen.runs))

    // ---- Timers: every one is tracked, and dies with the stage or with the next show(). ----
    let alive = true, step = 0, gen = 0
    const timers = new Set()
    const later = (fn, ms) => { const g = gen, t = setTimeout(() => { timers.delete(t); if (alive && g === gen) fn() }, ms); timers.add(t) }
    const stopTimers = () => { for (const t of timers) clearTimeout(t); timers.clear() }

    // Paint: one colour per cell. px is reused (map.paint copies it).
    const px = [0, 0, 0, 0]
    function paintSlope(alpha) {
      if (alpha <= 0) return map.paint(() => null)
      const c = getHazard()
      px[3] = alpha
      map.paint((i) => { px[0] = c[i * 3]; px[1] = c[i * 3 + 1]; px[2] = c[i * 3 + 2]; return px })
    }
    function paintBelief(strength) { // amber near the route, alpha relative to the strongest chance near the route
      const { near, b, max } = getBelief()
      if (!(max > 0) || strength <= 0) return map.paint(() => null)
      px[0] = AMBER_RGB[0]; px[1] = AMBER_RGB[1]; px[2] = AMBER_RGB[2]
      map.paint((i) => { if (!near[i]) return null; const a = (b[i] / max) * 230 * strength; if (a < 6) return null; px[3] = a; return px })
    }
    // Repaint `fn(value)` from one value to another in six steps over about 0.7 s, then hold.
    function fade(fn, from, to) {
      if (calm) return fn(to)
      fn(from)
      for (let n = 1; n <= 6; n++) later(() => fn(from + ((to - from) * n) / 6), n * 115)
    }
    // Show an element of ours at an opacity, fading in when it is the newest thing.
    function reveal(el, opacity, animate, delay = 0) {
      el.classList.remove('fa-fade')
      el.style.opacity = animate ? 0 : opacity
      map.svg.append(el)
      if (!animate) return
      el.getBoundingClientRect()
      later(() => { el.classList.add('fa-fade'); el.style.opacity = opacity }, delay)
    }

    function pins() {
      const k = map.scale
      map.dots('stops', [
        ...others.map((s) => ({ id: s.id, cell: s.cell, label: '', color: '#ffd23f', r: 1.3 * k, faded: true })),
        ...ordered.map((s, n) => ({ id: s.id, cell: s.cell, label: n + 1, color: '#ffd23f', r: 1.7 * k })),
        { id: 'base', cell: base, label: 'H', color: '#fff', r: 1.7 * k },
      ])
      map.raise('stops')
    }

    // The whole picture for step s. `animate` only moves the layer that step s adds.
    function show(s, animate = true) {
      if (!alive) return
      s = Math.max(0, Math.min(STEPS.length - 1, s))
      const fresh = animate && !calm
      gen++
      stopTimers()
      step = s
      const k = map.scale, thin = 0.45 * k
      for (const name of LAYERS) map.clear(name)
      steepEl.remove(); unseenEl.remove()
      unseenEl.classList.remove('fa-pulse')

      // 1. The straight line (white), then its too-steep parts (red). Faint from step 2, 25% from step 3.
      const sOp = s === 0 ? 1 : s === 1 ? 0.55 : 0.25
      map.line('fa-straight', straight, { color: '#fff', width: thin, opacity: sOp, dash: s === 0 ? '' : `${1.2 * k} ${1.2 * k}` })
      steepEl.setAttribute('stroke-width', thin * 1.9)
      if (s === 0 && fresh) { map.drawOn('fa-straight', 700); reveal(steepEl, 1, true, 750) } else reveal(steepEl, sOp, false)

      // 2. Slope colours over the picture; dimmed from step 3; replaced by the hidden-rock estimate from step 4.
      if (s === 0) paintSlope(0)
      else if (s === 1) fresh ? fade(paintSlope, 0, 150) : paintSlope(150)
      else if (s === 2) fresh ? fade(paintSlope, 150, 70) : paintSlope(70)
      else if (s === 3) fresh ? fade(paintBelief, 0, 1) : paintBelief(1)
      else paintBelief(0.55)

      // 5. The first flight: a translucent band as wide as the camera sees, with a thin centre line. Under the route.
      const f = s === 4 ? getFlight() : null
      if (f) {
        map.line('fa-band', f.waypoints, { color: SCOUT, width: (2 * app.scout.swathM) / cs, opacity: 0.3 })
        map.line('fa-centre', f.waypoints, { color: SCOUT, width: thin * 0.8 })
        if (fresh) { map.drawOn('fa-band', 1100); map.drawOn('fa-centre', 1100) }
      }

      // 3. The planned route (white). In step 4 it goes faint so the unseen stretches can pulse over it.
      if (s >= 2) {
        map.line('fa-route', cells, { color: '#fff', width: 0.6 * k, opacity: s === 3 ? 0.3 : 1 })
        if (s === 2 && fresh) map.drawOn('fa-route', 1200)
      }
      // 4. Route ground never seen up close: pulses.
      if (s === 3) { unseenEl.setAttribute('stroke-width', 0.6 * k); unseenEl.style.opacity = ''; unseenEl.classList.add('fa-pulse'); map.svg.append(unseenEl) }

      // Order, bottom to top: straight, steep, band, centre, route, unseen, pins.
      map.raise('fa-band'); map.raise('fa-centre'); map.raise('fa-route')
      if (unseenEl.isConnected) map.svg.append(unseenEl)
      pins()

      // The numbers exist from step 3 on.
      if (s >= 2) { if (!chip.isConnected) ui.strip.append(chip) } else chip.remove()
      energy.hidden = s < 2

      // Rail.
      const st = STEPS[s]
      count.textContent = `Route check ${s + 1} / ${STEPS.length}`
      segs.forEach((b, n) => { b.className = n === s ? 'now' : n < s ? 'done' : ''; n === s ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current') })
      const sec = ui.section(st.title, true)
      sec.classList.add('fa-text')
      for (const t of st.text()) sec.append(ui.h('p', '', t))
      if (st.small) sec.append(ui.h('p', 'dim', st.small()))
      const details = (st.models ?? []).map((m) => ui.model(m))
      if (st.detail) details.push(ui.h('p', 'dim', st.detail()))
      body.replaceChildren(sec, ...(details.length ? [ui.details('Method & limits', ...details)] : []))

      // Foot: Back and the primary button, always in the same place.
      const last = s === STEPS.length - 1
      backBtn.disabled = s === 0
      nextBtn.textContent = last ? 'Send the scout' : `Next: ${st.next}`
      nextBtn.disabled = last && left <= 0
      note.textContent = last && left <= 0 ? 'No flights left.' : ''
      note.hidden = !note.textContent
    }

    // Arrow keys step too (never past the last step: sending the scout takes the button).
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) show(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) show(step - 1)
    }
    addEventListener('keydown', onKey)
    // Sizes follow map.scale, which changes when the map's box does: redraw the same step, without animation.
    let resizeT = 0
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => show(step, false), 150) }
    addEventListener('resize', onResize)

    map.caption('How the route is found', 'NASA MRO HiRISE imagery and stereo terrain · USGS MSL Gale mosaic')
    map.fit([base, ...all.filter((s) => s.included).map((s) => s.cell), ...cells], 16)
    show(0)

    return () => {
      alive = false
      gen++
      stopTimers()
      clearTimeout(resizeT)
      removeEventListener('keydown', onKey)
      removeEventListener('resize', onResize)
      steepEl.remove(); unseenEl.remove()
      chip.remove()
    }
  },
}
