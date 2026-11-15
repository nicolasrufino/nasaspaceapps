// Stage 4, Choose the walk: back inside the habitat, at the console (docs/UX-PLAN.md section 0). The 2D map shows the
// scouted route against the route planned before the scout, with the rock cells the old one would have crossed. The
// rail holds the two routes as numbers. "Preview the walk" clears the main area for the 3D view behind the astronaut,
// with a height profile along the bottom that is also the playback scrubber.
// Every number here is read from `app` at run time. Picture: NASA MRO HiRISE (NASA/JPL-Caltech/University of Arizona);
// heights: the USGS MSL Gale terrain model in world.layers.height.
import { MODELS } from './models.js'
import * as stopScience from './stop-science.js'

const OCHRE = '#c5a065', WHITE = '#fff', AMBER = '#ffd23f', SCOUT = '#e3dfd3'
const SPEEDS = [[120, '1×'], [60, '2×'], [30, '4×']] // milliseconds per 8 m step
const STRIP_H = 110
const NS = 'http://www.w3.org/2000/svg'
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e }

const CSS = `
.d-route { cursor: pointer; border-radius: 10px; padding: 14px 12px; background: var(--panel2); border: 1px solid transparent; }
.d-route.hot { background: var(--panel2); }
.d-route.pin { border-color: var(--mute); }
.d-route h3 i { display: inline-block; width: 18px; height: 0; margin-right: 8px; vertical-align: middle; border-top: 3px solid #fff; }
.d-route.old h3 i { border-top: 3px dashed ${OCHRE}; }
.d-strip { align-self: stretch; height: ${STRIP_H}px; box-sizing: border-box; background: var(--panel); border-radius: 10px; padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 4px; }
.d-strip .lab { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: var(--mute); white-space: nowrap; }
.d-strip .lab b { color: var(--paper); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.d-strip svg { flex: 1; min-height: 0; width: 100%; display: block; cursor: ew-resize; touch-action: none; border-radius: 4px; }
@media (max-width: 760px) {
  .d-strip .lab { flex-wrap: wrap; gap: 2px 8px; white-space: normal; }
  .d-strip .lab b { order: 3; flex-basis: 100%; }
}
.d-win { display: grid; grid-template-columns: 1.25fr 1fr; gap: 10px; margin: 4px 0 4px; }
.d-win > div { background: var(--panel2); border-radius: 10px; padding: 10px 12px; }
.d-win small { display: block; color: var(--mute); font-size: 12px; }
.d-win b { display: block; font-size: 26px; line-height: 1.2; color: var(--paper); }
.d-win .good b { color: var(--scout); } .d-win .price b { font-size: 20px; }
.d-why { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.d-why li { position: relative; padding-left: 14px; font-size: 13px; line-height: 1.45; color: var(--paper); }
.d-why li::before { content: ''; position: absolute; left: 0; top: .55em; width: 6px; height: 6px; border-radius: 50%; background: var(--scout); }
.d-why.cost li { color: var(--mute); } .d-why.cost li::before { background: var(--mute); }
.d-bar { position: relative; height: 10px; border-radius: 5px; background: var(--panel2); overflow: hidden; margin: 6px 0 4px; }
.d-bar i { position: absolute; top: 0; bottom: 0; }
`

export default {
  enter(ui, app) {
    const { map } = ui
    const W = app.W
    if (!document.getElementById('d-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'd-style', textContent: CSS }))

    let mode = 'compare' // or 'preview'
    let timer = null, mine = [], hot = null, pin = null, speedK = 0, want = false, lastScale = 0, prof = null, live = null
    let sci = null // the Visit step (stop-science.js); null when off or its data did not load: the preview plays as before
    const sciData = stopScience.enabled() ? stopScience.load() : Promise.resolve(null)
    const setBody = (...nodes) => { for (const n of mine) n.remove(); mine = nodes; ui.body.append(...nodes) } // keeps the shell's Back button
    const rocksOn = (cells) => (cells ?? []).filter(([x, y]) => app.rockSeen(y * W + x))
    const p = (text, cls = '') => Object.assign(ui.h('p', cls), { textContent: text })

    // ---------- The map ----------
    function drawMap(mini) {
      const route = app.route(), before = app.scout.before()
      const stops = app.stops().filter((s) => s.included).map((s, n) => ({ ...s, n: n + 1 }))
      const oldCells = mini ? [] : before?.cells ?? []
      map.fit([app.meta.base_cell, ...route.cells, ...oldCells, ...stops.map((s) => s.cell)], mini ? 10 : 16)
      map.paintScouted()
      const k = map.scale * (mini ? 2 : 1)
      const em = mini ? null : pin ?? hot // the emphasised route, if any
      const lw = 0.45 * k
      map.line('before', oldCells, { color: OCHRE, width: lw, dash: `${lw * 2.2} ${lw * 2.4}`, opacity: em === 'new' ? 0.3 : 1 })
      map.dots('crossed', rocksOn(oldCells).map((cell) => ({ cell, color: OCHRE, ring: WHITE, r: 0.7 * k, faded: em === 'new' })))
      map.line('route', route.cells, { color: WHITE, width: lw * (em === 'new' ? 1.5 : 1), opacity: em === 'old' ? 0.3 : 1 })
      map.dots('stops', [
        { cell: app.meta.base_cell, label: 'H', color: WHITE, r: 1.6 * k },
        ...stops.map((s) => ({ cell: s.cell, label: s.n, color: AMBER, r: 1.6 * k, faded: s.dropped })),
      ])
      if (em === 'old') map.raise('before'), map.raise('crossed')
      else map.raise('route')
      map.raise('stops')
      lastScale = map.scale
      return k
    }

    // ---------- Comparison ----------
    const againBtn = ui.button('Scout again', () => ui.go('plan'))
    const stopsBtn = ui.button('Change the stops', () => ui.go('plan'))
    const previewBtn = ui.button('Preview the walk', startPreview, true)
    const visionBtn = ui.button('Explore in Vesta Vision', () => { location.href = './?vision' })

    function routeBlock(key, title, numbers) {
      const sec = ui.section('')
      sec.classList.add('d-route', key)
      const h3 = ui.h('h3', '', '<i></i>'); h3.append(title)
      sec.append(h3, ui.stats(numbers).el)
      sec.tabIndex = 0
      sec.setAttribute('role', 'button')
      sec.setAttribute('aria-pressed', pin === key)
      sec.classList.toggle('pin', pin === key)
      const emph = (v) => { hot = v ? key : null; sec.classList.toggle('hot', v); drawMap(false) }
      sec.onmouseenter = () => emph(true)
      sec.onmouseleave = () => emph(false)
      sec.onfocus = () => emph(true)
      sec.onblur = () => emph(false)
      sec.onclick = () => { pin = pin === key ? null : key; hot = null; compare() }
      sec.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sec.onclick() } }
      return sec
    }

    // The scout found rock on the orbit route: lead with what it bought (rock cells avoided), then what it cost.
    // Every number is read from the two routes at run time; nothing about the cost of meeting the rocks on foot is claimed.
    function compareWin(route, before, d, crossedOld, crossedNew) {
      const od = app.describe(before.cells)
      const extraJ = route.energy_j - before.energy_j, extraM = Math.round(d.metres - od.metres)
      const pct = Math.round((route.energy_j / app.usableJ) * 100), spare = ui.kj(app.usableJ - route.energy_j)
      const sign = (n) => (n >= 0 ? `+${n}` : `${n}`)
      const cells = (n) => `${n} rock ${n === 1 ? 'cell' : 'cells'}`

      const head = ui.section(crossedNew === 0 ? 'The scout cleared your path' : 'The scout made your path safer', true)
      head.append(p(`Same stops. The route planned from orbit walked into ${cells(crossedOld)} that orbit can't see. The scouted route goes around them.`, 'dim'))
      const win = ui.h('div', 'd-win', `<div class="good"><small>Rock cells on your path</small><b>${crossedOld} → ${crossedNew}</b></div>
        <div class="price"><small>The price</small><b>${sign(Math.round(extraJ / 1000))} kJ</b><small>${sign(+((extraJ / before.energy_j) * 100).toFixed(1))}% energy · ${sign(extraM)} m</small></div>`)
      head.append(win)

      const why = ui.section("Why it's better")
      why.append(ui.h('ul', 'd-why', `<li>No surprises on foot. Orbit misses rocks under about 1 m; the helicopter found these before anyone left.</li>
        <li>Decided in the habitat, not mid-walk. Without the scout the crew meets these rocks on the walk and chooses on the spot, with Earth up to 22 minutes away.</li>
        <li>The way home is worked out for the route you actually walk, so the walk-back ring can be trusted.</li>`))

      const costSec = ui.section('Why it costs a little more')
      costSec.append(ui.h('ul', 'd-why cost', `<li>It walks around the rocks instead of over them: ${extraM >= 0 ? `${extraM} m longer` : `${-extraM} m shorter`}. You still have ${spare} kJ to spare before the reserve.</li>`))
      const orbitW = Math.min(100, (before.energy_j / app.usableJ) * 100), allW = Math.min(100, (route.energy_j / app.usableJ) * 100)
      costSec.append(p(`Walking energy · ${ui.kj(route.energy_j)} of ${ui.kj(app.usableJ)} kJ (${pct}%)`, 'dim'),
        ui.h('div', 'd-bar', `<i style="left:0;width:${Math.min(orbitW, allW)}%;background:var(--mute)"></i><i style="left:${Math.min(orbitW, allW)}%;width:${Math.abs(allW - orbitW)}%;background:var(--scout)"></i>`),
        p(`Grey: the route from orbit (${ui.kj(before.energy_j)} kJ) · light: the scout's detour · the reserve is kept apart`, 'dim'))

      const blocks = [routeBlock('new', 'With the scout', [['metres', Math.round(d.metres)], ['kJ', ui.kj(route.energy_j)], ['rock cells crossed', crossedNew, crossedNew > 0 ? 'hazard' : undefined]]),
        routeBlock('old', 'Without the scout', [['metres', Math.round(od.metres)], ['kJ', ui.kj(before.energy_j)], ['rock cells crossed', crossedOld, 'hazard']])]
      const both = ui.details('Compare the two routes', ...blocks)

      const options = ui.details('More actions & model details', visionBtn)
      if (app.scout.left() > 0) options.querySelector('.f-details-body').append(againBtn)
      options.querySelector('.f-details-body').append(ui.model(MODELS.groundClassifier))
      setBody(head, why, costSec, both, options)
      previewBtn.disabled = route.cells.length < 2
      ui.foot.replaceChildren(previewBtn, stopsBtn)
    }

    function compare() {
      mode = 'compare'
      const route = app.route(), before = app.scout.before(), d = app.describe(route.cells)
      const crossedOld = before?.crossed ?? 0, crossedNew = rocksOn(route.cells).length
      if (!before) pin = hot = null

      map.caption('After scouting', before
        ? 'White: the scouted route · ochre dashes: without the scout · ochre dots: rock it would have crossed · NASA MRO HiRISE'
        : 'White: the route · NASA MRO HiRISE')
      map.clear('walker')
      drawMap(false)

      const headline = !before ? 'Review your route'
        : crossedOld > 0 ? 'A clearer way home'
        : 'Your route, checked'
      const head = ui.section(headline, true)
      if (before && crossedOld > 0) return compareWin(route, before, d, crossedOld, crossedNew)
      if (!before) head.append(p('No scouting yet: this is the route as seen from orbit.', 'dim'))
      else if (crossedOld > 0) head.append(p(`The route planned from orbit crossed ${crossedOld} rock ${crossedOld === 1 ? 'cell' : 'cells'} the scout found.`, 'dim'))
      else head.append(p('The scout found no rock on the route planned from orbit.', 'dim'))

      const blocks = [routeBlock('new', before ? 'With the scout' : 'The route',
        [['metres', Math.round(d.metres)], ['kJ', ui.kj(route.energy_j)], ['rock cells crossed', crossedNew, crossedNew > 0 ? 'hazard' : undefined]])]
      if (before) {
        const od = app.describe(before.cells)
        blocks.push(routeBlock('old', 'Without the scout',
          [['metres', Math.round(od.metres)], ['kJ', ui.kj(before.energy_j)], ['rock cells crossed', crossedOld, 'hazard']]))
      }

      const pct = Math.round((route.energy_j / app.usableJ) * 100)
      const extra = before ? Math.round((route.energy_j - before.energy_j) / 1000) : 0
      const extraPct = before ? ((route.energy_j - before.energy_j) / before.energy_j) * 100 : 0
      const cost = extra > 0 ? `costs ${extra} kJ more (+${extraPct.toFixed(1)}%)` : extra < 0 ? `costs ${-extra} kJ less (${extraPct.toFixed(1)}%)` : 'costs the same energy'
      // pct is the whole route's share of the energy you may spend walking (budget minus reserve), not the difference.
      const share = `The whole walk uses ${pct}% of the ${ui.kj(app.usableJ)} kJ you can spend walking; the reserve stays untouched.`
      const sum = ui.section('')
      if (before) sum.append(p(`The scouted route ${cost} than the one planned from orbit.`))
      sum.append(p(share))

      const options = ui.details('More actions & model details', visionBtn)
      if (app.scout.left() > 0) options.querySelector('.f-details-body').append(againBtn)
      options.querySelector('.f-details-body').append(ui.model(MODELS.groundClassifier))
      setBody(head, ...blocks, sum, options)
      previewBtn.disabled = route.cells.length < 2
      ui.foot.replaceChildren(previewBtn, stopsBtn)
    }

    // ---------- Preview ----------
    // Height along the route: x = distance walked (diagonal steps are longer), y = height from the terrain model.
    function profile(cells) {
      const hgt = app.world.layers.height, cum = [0]
      for (let i = 1; i < cells.length; i++) cum.push(cum[i - 1] + app.cs * Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]))
      const total = cum[cum.length - 1] || 1
      const hs = cells.map(([x, y]) => hgt[y * W + x])
      let lo = Infinity, hi = -Infinity
      for (const v of hs) { if (v < lo) lo = v; if (v > hi) hi = v }
      const span = hi - lo || 1
      const X = (i) => (cum[i] / total) * 1000, Y = (i) => 90 - ((hs[i] - lo) / span) * 78
      const area = `M0,100 ${cells.map((_, i) => `L${X(i).toFixed(1)},${Y(i).toFixed(1)}`).join(' ')} L1000,100 Z`
      // The step whose distance is nearest to fraction f of the way.
      const stepAt = (f) => { const t = f * total; let i = 0; while (i < cum.length - 1 && cum[i + 1] <= t) i++; return i < cum.length - 1 && t - cum[i] > cum[i + 1] - t ? i + 1 : i }
      return { cum, total, area, X, stepAt, climb: Math.round(hi - lo) }
    }

    function startPreview() {
      const route = app.route()
      if (mode === 'preview' || route.cells.length < 2) return
      mode = 'preview'
      const d = app.describe(route.cells), totalM = Math.round(d.metres)
      prof = profile(route.cells)

      ui.scene(true)
      app.camera('walker')
      app.walk.reset()
      app.walk.speed(SPEEDS[(speedK = 0)][0])
      app.walk.play()
      want = true

      // Rail
      const head = ui.section('Walk preview', true)
      const note = p('Plays automatically. Drag the height strip to jump.', 'dim')
      head.append(note)
      const nums = ui.section('')
      const stats = ui.stats([[`metres of ${totalM}`, '0'], ['kJ left', '0', 'scout'], ['% of the way', '0']])
      const bar = ui.bar()
      nums.append(stats.el, bar.el)
      setBody(head, nums)

      // Controls
      const playBtn = ui.button('Pause', () => {
        if (sci?.active()) return sci.proceed()
        const s = app.walk.state()
        if (s.k >= s.of || s.energy_left_j <= 0) { app.walk.reset(); app.walk.play(); want = true }
        else if (want || app.walk.playing()) { app.walk.pause(); want = false }
        else { app.walk.play(); want = true }
        tick()
      }, true)
      const stepBtn = ui.button('Step', () => { want = false; app.walk.pause(); app.walk.step(); tick() })
      const speedBtn = ui.button(SPEEDS[0][1], () => { speedK = (speedK + 1) % SPEEDS.length; app.walk.speed(SPEEDS[speedK][0]); speedBtn.textContent = SPEEDS[speedK][1] })
      speedBtn.setAttribute('aria-label', 'Walking speed')
      const restartBtn = ui.button('Restart', () => { app.walk.reset(); app.walk.play(); want = true; tick() })
      const backBtn = ui.button('Back to the comparison', stopPreview)
      const r1 = ui.h('div', 'f-row'), r2 = ui.h('div', 'f-row')
      r1.append(playBtn)
      r2.append(stepBtn, speedBtn, restartBtn)
      ui.foot.replaceChildren(r1, r2, backBtn)

      // Bottom strip: the height profile, which is also the scrubber.
      const strip = ui.h('div', 'd-strip', '<div class="lab"><span>Height along the route</span><b></b><span></span></div>')
      const [, msg, right] = strip.firstChild.children
      right.textContent = `${totalM} m · ${prof.climb} m elevation range`
      const svg = svgEl('svg', { viewBox: '0 0 1000 100', preserveAspectRatio: 'none', role: 'slider', 'aria-label': 'Position along the route', tabindex: 0 })
      const clip = svgEl('clipPath', { id: 'd-clip' }), clipRect = svgEl('rect', { x: 0, y: 0, width: 0, height: 100 })
      clip.append(clipRect)
      const head2 = svgEl('line', { x1: 0, x2: 0, y1: 0, y2: 100, stroke: SCOUT, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' })
      svg.append(clip, svgEl('rect', { x: 0, y: 0, width: 1000, height: 100, fill: '#2a2927' }),
        svgEl('path', { d: prof.area, fill: '#6e6a65' }), svgEl('path', { d: prof.area, fill: SCOUT, opacity: 0.55, 'clip-path': 'url(#d-clip)' }), head2)
      strip.append(svg)
      const seekTo = (e) => { const b = svg.getBoundingClientRect(); app.walk.seek(prof.stepAt(Math.max(0, Math.min(1, (e.clientX - b.left) / (b.width || 1))))); tick() }
      let dragging = false
      svg.onpointerdown = (e) => { dragging = true; svg.setPointerCapture?.(e.pointerId); seekTo(e) }
      svg.onpointermove = (e) => { if (dragging) seekTo(e) }
      svg.onpointerup = svg.onpointercancel = () => { dragging = false }
      svg.onkeydown = (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (!dir) return
        e.preventDefault()
        const s = app.walk.state()
        app.walk.seek(Math.max(0, Math.min(s.of, s.k + dir * 5))); tick()
      }
      ui.bottom.replaceChildren(strip)

      // Mini map, above the strip.
      ui.br.style.bottom = `${16 + STRIP_H + 8}px`
      ui.br.replaceChildren(map.el)
      map.size('mini')
      map.caption('The walk', '')
      let mk = drawMap(true)

      live = { stats, bar, playBtn, stepBtn, msg, note, head2, clipRect, totalM, redraw: () => { mk = drawMap(true) }, k: () => mk }
      const session = live
      sciData.then((d) => { if (!d || live !== session) return; sci = stopScience.createStopScience(ui, app, d); mine.push(sci.el); ui.body.append(sci.el) })
      tick()
      timer = setInterval(tick, 200)
    }

    function tick() {
      if (mode !== 'preview' || !live) return
      const s = app.walk.state(), cells = app.route().cells
      const k = Math.max(0, Math.min(s.k, cells.length - 1)), of = Math.max(1, s.of)
      const done = s.k >= s.of, spent = !done && s.energy_left_j <= 0
      // The Visit step: at a stop, put the walker on it and wait for "Carry on walking".
      const hit = sci?.at(s.k, () => { want = true; app.walk.play(); tick() })
      if (hit) { want = false; app.walk.pause(); app.walk.seek(hit.k); return tick() }
      // The walk pauses itself at a stop; carry on, since this preview plays by itself.
      if (want && !done && !spent && !app.walk.playing()) app.walk.play()
      if (done || spent) want = false
      if (done) sci?.finish()
      if (map.scale !== lastScale) live.redraw() // the mini map's box changed size
      if (cells[k]) { map.dots('walker', [{ cell: cells[k], color: SCOUT, ring: WHITE, r: 1.3 * live.k() }]); map.raise('walker') }
      const f = prof.cum[k] / prof.total
      live.stats.set(0, Math.round(live.totalM * f))
      live.stats.set(1, ui.kj(Math.max(0, s.energy_left_j)))
      live.stats.set(2, Math.round((s.k / of) * 100))
      live.bar.set(f)
      const x = prof.X(k)
      live.head2.setAttribute('x1', x); live.head2.setAttribute('x2', x)
      live.clipRect.setAttribute('width', x)
      const visiting = sci?.active()
      live.stepBtn.disabled = !!visiting
      const text = done ? 'Arrived back at the habitat.' : spent ? 'Out of walking energy before the habitat.'
        : visiting ? 'Paused at a science stop. Complete tasks below or carry on walking.' : ''
      live.msg.textContent = text
      live.note.textContent = text || 'Plays automatically. Drag the height strip to jump.'
      live.playBtn.textContent = done || spent ? 'Restart' : visiting ? 'Carry on walking' : want || app.walk.playing() ? 'Pause' : 'Play'
    }

    function leavePreview() {
      clearInterval(timer); timer = null
      want = false
      live = null
      sci = null
      app.walk.pause()
      app.walk.speed(SPEEDS[0][0])
      ui.br.style.bottom = ''
      ui.br.replaceChildren()
      ui.bottom.replaceChildren()
      map.clear('walker')
    }

    function stopPreview() {
      if (mode !== 'preview') return
      leavePreview()
      ui.scene(false)
      compare()
    }

    // ---------- Go ----------
    const onResize = () => { if (mode === 'compare') drawMap(false) }
    addEventListener('resize', onResize)
    const off = app.on('plan', () => { if (mode === 'compare') compare() })
    const offWalk = app.on('walk:step', tick) // visit every crossed stop, even when a slow frame advances several cells
    compare()

    return () => {
      removeEventListener('resize', onResize)
      off()
      offWalk()
      leavePreview()
      mode = 'compare'
      for (const n of mine) n.remove()
      mine = []
      for (const name of ['before', 'crossed', 'walker']) map.clear(name)
    }
  },
}
