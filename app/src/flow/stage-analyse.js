// Stage 2, Read the orbit map (docs/UX-PLAN.md): about 9 s, automatic, skippable. The system shows its own reasoning
// one line at a time, each tied to something drawn on the 2D map (NASA MRO HiRISE picture): the planned route, the
// experimental chance of rocks too small for orbit to see, the route ground no helicopter has seen, the first flight.
// Every number is read from `app` when the step runs.
const SVG = 'http://www.w3.org/2000/svg'
const STEP_MS = 2100 // one line of reasoning
const NEAR = 12 // cells either side of the route that get the hidden-rock estimate
const CSS = `
@keyframes fa-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .2 } }
.fa-unseen { animation: fa-pulse 1s ease-in-out infinite; }
.fa-line { max-width: min(560px, 92vw); text-align: center; font-size: clamp(16px, 2.3vw, 21px); line-height: 1.3; font-weight: 600;
  color: var(--paper); background: #191919c7; backdrop-filter: blur(10px); border: 1px solid var(--rule); border-radius: 14px; padding: 12px 20px; box-sizing: border-box; opacity: 0; transform: translateY(6px); transition: opacity .3s, transform .3s; }
.fa-line.on { opacity: 1; transform: none; }
.fa-sub { min-height: 1.3em; text-align: center; text-shadow: 0 1px 4px #000; }
.fa-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; font-size: 14px; color: var(--mute); }
.fa-list li { display: flex; gap: 10px; align-items: center; transition: color .3s; }
.fa-list li::before { content: ""; flex: none; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--mute); box-sizing: border-box; transition: background .3s, border-color .3s; }
.fa-list li.now { color: var(--paper); } .fa-list li.now::before { border-color: var(--scout); }
.fa-list li.done { color: var(--paper); } .fa-list li.done::before { background: var(--scout); border-color: var(--scout); }
@media (prefers-reduced-motion: reduce) { .fa-unseen { animation: none; } }
`
const metresText = (m) => `${Math.round(m)} m`
const flightText = (m) => (m >= 1000 ? `${+(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

export default {
  enter(ui, app) {
    app.camera('habitat')
    const { map } = ui
    const { W, H, cs } = app
    if (!document.getElementById('fa-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'fa-style', textContent: CSS }))

    // Read the plan once: this stage only watches, nothing can change the route while it runs.
    const route = app.route()
    const cells = route.cells ?? []
    const routeM = cells.length > 1 ? app.describe(cells).metres : 0
    const stopCount = route.stops?.length ?? 0
    // Route ground never seen up close: steps of the route that end on a cell no helicopter has looked at.
    const runs = [] // contiguous stretches of unseen route cells, for drawing
    let unseenM = 0, run = null
    cells.forEach(([x, y], n) => {
      if (app.scanned[y * W + x]) { run = null; return }
      if (n > 0) unseenM += Math.hypot(x - cells[n - 1][0], y - cells[n - 1][1]) * cs
      if (!run) runs.push((run = []))
      run.push([x, y])
    })
    const left = app.scout.left()

    // Layout
    map.size('big')
    map.clear()
    map.fit([...cells, app.meta.base_cell], 18)
    const k = map.scale
    map.caption('Reading the orbit map', 'NASA MRO HiRISE')
    ui.center.append(map.el)

    const steps = ui.card('What the system is checking')
    const list = ui.h('ul', 'fa-list')
    const items = ['Route', 'Hidden-rock estimate', 'Unseen ground', 'Flight plan'].map((t) => { const li = ui.h('li'); li.textContent = t; list.append(li); return li })
    const small = ui.h('p', 'f-small')
    small.textContent = 'Planning with unknown blockages: the Canadian Traveller Problem.'
    small.style.marginTop = '12px'
    steps.append(list, small)
    ui.left.append(steps)

    const numbers = ui.card('From the planner')
    const stats = ui.stats([['route metres', '–'], ['metres not seen up close', '–', 'hazard'], [left === 1 ? 'flight available' : 'flights available', '–', 'scout']])
    numbers.append(stats.el)
    ui.right.append(numbers)

    const line = ui.h('div', 'fa-line'), sub = ui.h('div', 'f-small fa-sub')
    line.setAttribute('aria-live', 'polite')
    const launch = ui.button('Launch', () => go(), true)
    launch.style.visibility = 'hidden'
    ui.bottom.append(line, sub, launch)
    ui.bl.append(ui.button('Skip', () => go()))

    // Everything that could fire later is tracked here so cleanup can stop it.
    let dead = false, raf = 0
    const timers = new Set()
    const after = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn() }, ms); timers.add(t) }
    const go = () => { if (!dead) ui.go('scout') }
    const extra = document.createElementNS(SVG, 'g') // our own drawing (the pulsing unseen stretches), removed on cleanup

    function say(n, text, subText = '') {
      items.forEach((li, j) => { li.className = j < n ? 'done' : j === n ? 'now' : '' })
      line.classList.remove('on')
      after(140, () => { line.textContent = text; sub.textContent = subText; line.classList.add('on') })
    }
    function drawStops() {
      map.dots('stops', [
        { cell: app.meta.base_cell, label: 'H', color: '#fff', r: 6 * k },
        ...app.stops().filter((s) => s.included && !s.dropped).map((s) => ({ cell: s.cell, r: 4 * k })),
      ])
    }

    const run4 = [
      // 1. The planned route draws itself.
      () => {
        map.line('route', cells, { color: '#fff', width: 2.2 * k })
        map.drawOn('route', STEP_MS - 500)
        drawStops()
        stats.set(0, Math.round(routeM))
        say(0, cells.length > 1 ? `Planned route: ${metresText(routeM)} through ${stopCount} ${stopCount === 1 ? 'stop' : 'stops'}.` : 'No route planned yet.')
      },
      // 2. Chance of a hidden rock, around the route only. Amber, stronger where the chance is higher.
      () => {
        say(1, 'Orbit sees rocks down to about 1.5 m. Smaller ones are a guess.', 'Amber: experimental estimate of hidden rocks, not calibrated.')
        let belief = null
        try { belief = app.belief() } catch { belief = null }
        if (!belief) return
        const near = new Uint8Array(W * H)
        for (const [cx, cy] of cells) {
          for (let y = Math.max(0, cy - NEAR); y <= Math.min(H - 1, cy + NEAR); y++) {
            for (let x = Math.max(0, cx - NEAR); x <= Math.min(W - 1, cx + NEAR); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= NEAR * NEAR) near[y * W + x] = 1
          }
        }
        let top = 0
        for (let i = 0; i < W * H; i++) if (near[i] && belief[i] > top) top = belief[i]
        if (!(top > 0)) return
        // Alpha is relative to the highest chance near the route, so the layer shows where the guess is stronger, not how strong.
        const t0 = performance.now(), FADE = 900
        let last = -1
        const frame = (now) => {
          if (dead) return
          const f = Math.min(1, (now - t0) / FADE), q = Math.ceil(f * 6) // six repaints are enough for a fade
          if (q !== last) {
            last = q
            const a = (q / 6) * 190
            map.paint((i) => (near[i] && belief[i] > 0 ? [255, 176, 32, Math.round(a * Math.min(1, belief[i] / top))] : null))
          }
          if (f < 1) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      },
      // 3. Route ground no helicopter has seen: pulses red.
      () => {
        stats.set(1, Math.round(unseenM))
        if (!runs.length) return say(2, 'All of this route has been seen up close.')
        const d = runs.map((r) => (r.length === 1 ? [r[0], r[0]] : r).map(([x, y], n) => `${n ? 'L' : 'M'}${x + 0.5} ${y + 0.5}`).join('')).join('')
        const path = document.createElementNS(SVG, 'path')
        for (const [a, v] of Object.entries({ d, fill: 'none', stroke: '#ff5a3d', 'stroke-width': 4.2 * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'fa-unseen' })) path.setAttribute(a, v)
        extra.append(path)
        map.svg.append(extra)
        drawStops() // keep the stops above the pulse
        say(2, `${metresText(unseenM)} of this route has never been seen up close.`, `Measured along the route in ${cs} m cells.`)
      },
      // 4. The first flight the scout would fly, as wide as what it sees.
      () => {
        stats.set(2, left)
        let first = null
        try { first = app.scout.preview() } catch { first = null }
        if (first?.waypoints?.length > 1) {
          map.line('corridor', first.waypoints, { color: '#35e0ff', width: (2 * app.scout.swathM) / cs, opacity: 0.28 })
          map.line('flight', first.waypoints, { color: '#35e0ff', width: 1.2 * k })
          map.drawOn('corridor', 1100); map.drawOn('flight', 1100)
          drawStops()
        }
        const each = flightText(app.scout.flightM)
        const text = left <= 0 ? 'No flights left. The walk uses what has been seen so far.'
          : `${left === 1 ? `One flight of ${each}.` : `Up to ${left} flights of ${each} each.`} The scout re-plans after every landing.`
        say(3, text, first?.waypoints?.length > 1 ? `Cyan: the first flight, ${metresText(first.metres)}, drawn as wide as the ${2 * app.scout.swathM} m it sees.` : '')
      },
      // Done: tick the last step, offer Launch, and go on by itself.
      () => {
        items.forEach((li) => { li.className = 'done' })
        launch.style.visibility = ''
        after(STEP_MS, go)
      },
    ]
    run4.forEach((fn, n) => after(n === 0 ? 60 : n * STEP_MS, fn))

    return () => {
      dead = true
      for (const t of timers) clearTimeout(t)
      timers.clear()
      cancelAnimationFrame(raf)
      extra.remove()
      map.clear()
    }
  },
}
