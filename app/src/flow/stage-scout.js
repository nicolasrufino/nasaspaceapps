// Stage 3, Scout: third person behind the helicopter while it flies its corridors (docs/UX-PLAN.md section 0).
// A control centre over the 3D view, no rail: top left the flight (progress, speed, totals), bottom left the findings
// as cards (what was found, and what it means for the route), bottom right the mini map with the same numbers.
// Instruments, limits and sources live on the docs page (DECISIONS 2026-11-15), not here.
// The scan is simulated: rocks come from the stored rock layer (the terrain roughness estimate plus the reviewed
// NASA MRO HiRISE detections, see models.js), not from a live classifier.
// Colour means what a find asks of the walk (DECISIONS 2026-11-15), always with a word and a glyph beside it:
// red, on your route: walk around it; green, the re-plan moved the route off it; grey, off the route: recorded, no action.

const SCOUT = '#e3dfd3'
export const KIND = { // in list order; rgb paints the rock cells on the 3D ground and the 2D map
  on: { color: '#ff2d2d', rgb: [255, 45, 45], glyph: '▲', tag: 'On route', head: 'On your route' },
  clear: { color: '#46aa5a', rgb: [70, 170, 90], glyph: '✓', tag: 'Avoided', head: 'Re-planned around' },
  off: { color: '#a9a6a2', rgb: [169, 166, 162], glyph: '○', tag: 'Off route', head: 'Off your route' },
}
const NORMAL_S = 40, SKIP_S = 0.4 // screen seconds per flight at 1×, and when finishing
const SPEEDS = [1, 2, 4, 8]
const FIND_GAP_M = 40 // rocks after this much flight without any start a new find
const MAX_CARDS = 4
// The last scouting, for the mission hub's flight replay (stage-debrief.js): each flight's path, and the findings.
export const log = { flights: [], finds: [] }

const CSS = `
.sc-panel { background: var(--panel); border-radius: 14px; padding: 14px 16px; width: 340px; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; }
.sc-panel h2 { margin: 0; font-size: 20px; line-height: 1.2; text-transform: none; letter-spacing: 0; color: var(--paper); }
.sc-panel .f-flight-progress { margin: 0; }
.sc-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: var(--mute); }
.sc-row b { color: var(--paper); font-variant-numeric: tabular-nums; }
.sc-speed { display: flex; gap: 4px; }
#flow .sc-speed button.f-btn { min-width: 44px; padding: 0 10px; }
#flow .sc-panel button.f-btn:not(.primary) { font-size: 13px; }
.sc-panel .f-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sc-panel .f-stat b { font-size: 20px; } .sc-panel .f-stat span { font-size: 11px; }
.sc-news { margin: 0; font-size: 13px; padding-left: 10px; border-left: 3px solid var(--scout); } .sc-news.moved { border-left-color: var(--clear); } .sc-news.on { border-left-color: var(--avoid); }
.sc-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: var(--mute); }
.sc-legend span { display: flex; gap: 6px; align-items: center; } .sc-legend i { width: 12px; height: 8px; border-radius: 2px; }
.sc-legend b { font-size: 10px; line-height: 1; }
#f-strip.sc-tl { left: 16px; right: auto; }
#f-bl.sc-finds { flex-direction: column; align-items: stretch; width: 340px; gap: 6px; }
.sc-finds h3 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--paper); text-shadow: 0 1px 3px #000; }
.sc-finds h4 { margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--paper); text-shadow: 0 1px 3px #000; }
.sc-card { display: flex; gap: 10px; align-items: center; background: var(--panel); border-radius: 12px; padding: 10px 12px; border-left: 4px solid #57534e; }
.sc-card.on { border-left-color: var(--avoid); } .sc-card.clear { border-left-color: var(--clear); }
.sc-card .n { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 12px; background: #44413c; color: var(--paper); }
.sc-card.on .n { background: var(--avoid); color: var(--ink); } .sc-card.clear .n { background: var(--clear); color: var(--ink); }
.sc-card .t { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; }
.sc-card .t small { display: block; font-weight: 400; font-size: 12px; color: var(--mute); }
.sc-card.on .t small { color: var(--paper); }
.sc-card .tag { flex: none; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #44413c; color: var(--paper); white-space: nowrap; }
.sc-card.on .tag { background: var(--avoid); color: var(--ink); } .sc-card.clear .tag { background: var(--clear); color: var(--ink); }
@media (max-width: 760px) {
  #f-strip.sc-tl { left: 8px; right: 8px; } .sc-panel { width: 100%; padding: 10px 12px; gap: 8px; } .sc-panel h2 { font-size: 16px; }
  .sc-legend { display: none; }
  #f-bl.sc-finds { left: 8px; bottom: 8px; width: calc(100% - 128px); }
  .sc-finds .sc-card:nth-of-type(n+2), .sc-finds h3, .sc-finds h4 { display: none; }
  .sc-card { padding: 8px 10px; } .sc-card .tag { padding: 3px 6px; } .sc-card .tag span { display: none; } /* the glyph stays; the words are in the card */
}
`

export default {
  enter(ui, app) {
    ui.scene(true, true)
    const { map } = ui
    const { cs, W } = app
    const offs = [], timers = new Set()
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }
    const style = ui.h('style', '', CSS)
    document.head.append(style)
    const num = (v) => Math.round(v).toLocaleString('en-US')
    const signedKj = (j) => { const v = Math.round(j / 1000); return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} kJ` }

    // ---- The control centre, top left. ----
    const panel = ui.h('div', 'sc-panel')
    const title = ui.h('h2', '', `Flight 1 of ${app.MAX_FLIGHTS ?? 3}`)
    const dist = ui.bar()
    dist.el.classList.add('f-flight-progress')
    dist.el.setAttribute('role', 'progressbar')
    dist.el.setAttribute('aria-label', 'Flight progress')
    dist.el.setAttribute('aria-valuemin', '0')
    dist.el.setAttribute('aria-valuemax', '100')
    dist.el.setAttribute('aria-valuenow', '0')
    const status = ui.h('div', 'sc-row', '<span>Simulated scan · stored HiRISE data</span><b>Taking off</b>')
    const distText = status.lastChild
    const totals = ui.stats([['m² scanned', '0', 'scout'], ['rock cells found', '0'], ['▲ on your route', '0', 'avoid']])
    const stripM = Math.round(2 * (app.scout.swathM ?? 15))
    const key = (k, text) => `<span><i style="background:${KIND[k].color}"></i><b aria-hidden="true">${KIND[k].glyph}</b>${text}</span>`
    const legend = ui.h('div', 'sc-legend', `<span><i style="background:${SCOUT}"></i>seen (${stripM} m strip)</span>` +
      key('on', 'rock on your route: walk around') + key('clear', 'route moved off it') + key('off', 'rock off route'))

    // Speed: pick one; Finish flies the rest at once.
    let skipped = false
    const speedRow = ui.h('div', 'sc-row'), seg = ui.h('div', 'sc-speed')
    const speedBtns = SPEEDS.map((x) => {
      const b = ui.button(`${x}×`, () => setSpeed(x))
      b.setAttribute('aria-label', `Fly at ${x}× speed`)
      seg.append(b)
      return b
    })
    function setSpeed(x) {
      if (skipped) return
      app.scout.seconds(NORMAL_S / x)
      speedBtns.forEach((b, k) => b.setAttribute('aria-pressed', SPEEDS[k] === x))
    }
    const skip = ui.button('Finish flights', () => {
      skipped = true
      app.camera('map') // stand back: a chase camera at this speed whips across the ground
      app.scout.seconds(SKIP_S)
      for (const b of [...speedBtns, skip]) b.disabled = true
    })
    skip.setAttribute('aria-label', 'Skip to the end of the flights')
    speedRow.append(seg, skip)
    const next = ui.button('See the path we made', () => ui.go('debrief'), true)
    next.hidden = true
    const news = ui.h('p', 'sc-news'); news.hidden = true
    panel.append(title, dist.el, status, speedRow, totals.el, news, legend, next)
    ui.strip.classList.add('sc-tl')
    ui.strip.append(panel)

    // ---- Findings, bottom left: newest on top. ----
    ui.bl.classList.add('sc-finds')
    const findsHead = ui.h('h3', '', 'Findings · 0')

    // ---- Mini map, bottom right. ----
    map.size('mini')
    map.caption('Seen so far')
    map.clear()
    ui.br.append(map.el)
    const stopCells = () => app.stops().filter((s) => s.included && !s.dropped).map((s) => s.cell)
    let routeSet = new Set()
    const findOf = new Map() // rock cell -> its find
    // A find is 'on' while one of its cells is on the route, 'clear' once a re-plan moved the route off all of them.
    const classify = (f) => { f.kind = f.idx.some((i) => routeSet.has(i)) ? 'on' : f.onRoute ? 'clear' : 'off' }
    // Every seen rock: its find's colour; a rock not yet grouped (the scan dot drawn before the 'scan' event) by the route.
    // Left set when the stage closes, so the hub's maps keep the same colours. ponytail: no reset, the next scouting replaces it.
    const rockRGB = (i) => KIND[findOf.get(i)?.kind ?? (routeSet.has(i) ? 'on' : 'off')].rgb
    app.setRockColor(rockRGB)
    function drawRoute() {
      const k = map.scale, cells = app.route().cells
      routeSet = new Set(cells.map(([x, y]) => y * W + x))
      map.line('route', cells, { color: '#fff', width: 0.9 * k })
      map.dots('stops', [{ cell: app.meta.base_cell, color: '#fff', r: 2.6 * k }, ...stopCells().map((cell) => ({ cell, r: 2.4 * k }))])
    }
    map.fit([app.meta.base_cell, ...app.route().cells, ...stopCells()], 16)
    drawRoute()
    map.paintScouted()

    // Live state: written by the events, drawn by the two timers below (never on every frame).
    let tick = null, flying = false, started = false, dirty = false, mapDirty = false, findsDirty = true, landed = false
    let seenCells = 0, rockCells = 0, onRouteCells = 0, hot = null
    const finds = [] // { n, flight, along, cells, onRoute, cell, result }
    log.flights = []; log.finds = finds
    let cur = null, lastRockAlong = -Infinity, lastRockFlight = 0

    offs.push(app.on('flight:start', (e) => {
      started = flying = true
      tick = { ...e, along: 0 }
      log.flights.push({ n: e.n, waypoints: e.waypoints, metres: e.metres })
      title.textContent = `Flight ${e.n} of ${e.of}`
      cur = null
      dirty = true
    }))
    offs.push(app.on('flight:tick', (e) => { tick = e; dirty = mapDirty = true }))
    offs.push(app.on('scan', (e) => {
      seenCells += e.seen ?? 0
      dirty = true
      const rocks = e.rocks ?? []
      if (!rocks.length) return
      if (!cur || lastRockFlight !== e.n || e.along - lastRockAlong >= FIND_GAP_M) {
        const i = rocks[0]
        cur = { n: finds.length + 1, flight: e.n, along: e.along, cells: 0, onRoute: 0, cell: [i % W, Math.floor(i / W)], result: '', kj: '', idx: [], kind: 'off' }
        finds.push(cur)
      }
      lastRockAlong = e.along; lastRockFlight = e.n
      const hit = rocks.filter((i) => routeSet.has(i)).length // the route as it is now, before any re-plan
      cur.cells += rocks.length; cur.onRoute += hit
      for (const i of rocks) { cur.idx.push(i); findOf.set(i, cur) }
      classify(cur)
      rockCells += rocks.length; onRouteCells += hit
      findsDirty = mapDirty = true
    }))
    offs.push(app.on('flight:end', ({ n, summary }) => {
      const s = summary ?? {}
      flying = false
      cur = null
      const kj = Math.round((s.energy_delta_j ?? 0) / 1000) ? `, ${signedKj(s.energy_delta_j)}` : ''
      const hits = finds.filter((f) => f.flight === n && f.onRoute)
      for (const f of hits) { f.result = s.avoided_cells ? `route moved${kj}` : 'route unchanged'; f.kj = s.avoided_cells ? kj : '' }
      const rocks = s.found_cells ? `${s.found_cells} rock cells found` : 'no rocks found'
      news.textContent = `Flight ${n} landed: ${rocks}, ${s.avoided_cells ? 'route moved' : 'route unchanged'}${kj}.` // in the panel, not a toast over the findings
      news.classList.toggle('moved', !!s.avoided_cells)
      news.classList.toggle('on', !s.avoided_cells && hits.length > 0)
      news.hidden = false
      if (tick) tick = { ...tick, along: tick.metres }
      dirty = mapDirty = findsDirty = true
    }))
    offs.push(app.on('plan', () => {
      drawRoute(); map.raise('finds'); map.raise('heli')
      finds.forEach(classify)
      onRouteCells = finds.reduce((n, f) => n + f.idx.filter((i) => routeSet.has(i)).length, 0) // on the route as it is now
      app.setRockColor(rockRGB) // repaint the 3D ground with the new kinds
      dirty = mapDirty = findsDirty = true
    }))
    offs.push(app.on('landed', () => {
      flying = false
      landed = true
      speedRow.hidden = true
      next.hidden = false
      dirty = mapDirty = true
    }))

    function drawFindDots() {
      const k = map.scale
      map.dots('finds', finds.map((f) => ({ cell: f.cell, label: f.n, color: KIND[f.kind].color, ring: f.n === hot ? '#fff' : '#191919', r: (f.n === hot ? 4.2 : 3.2) * k })))
    }
    const say = {
      on: (f) => f.result === 'route unchanged' ? 'Route unchanged: walk around it' : 'Walk around it: the route will be re-planned',
      clear: (f) => `Route re-planned around it${f.kj}`,
      off: (f) => `Flight ${f.flight} · recorded, no action needed`,
    }
    function card(f) {
      const e = ui.h('div', `sc-card ${f.kind}`, '<span class="n"></span><span class="t"></span><span class="tag"><b aria-hidden="true"></b> <span></span></span>')
      e.children[0].textContent = f.n
      e.children[1].textContent = `Rock field · about ${num(f.cells * cs * cs)} m²`
      const s = ui.h('small')
      s.textContent = say[f.kind](f)
      e.children[1].append(s)
      e.children[2].firstChild.textContent = KIND[f.kind].glyph
      e.children[2].lastChild.textContent = KIND[f.kind].tag
      e.onmouseenter = () => { hot = f.n; drawFindDots() }
      e.onmouseleave = () => { hot = null; drawFindDots() }
      return e
    }
    // Grouped by what each find asks of the walk, most urgent first, newest first in a group; at most MAX_CARDS cards.
    function drawFinds() {
      findsHead.textContent = `Findings · ${finds.length}`
      if (!finds.length) return ui.bl.replaceChildren()
      const out = [findsHead]
      let room = MAX_CARDS
      for (const k of Object.keys(KIND)) {
        const group = finds.filter((f) => f.kind === k).reverse()
        if (!group.length) continue
        out.push(ui.h('h4', '', `${KIND[k].glyph} ${KIND[k].head} · ${group.length}`), ...group.slice(0, room).map(card))
        room = Math.max(0, room - group.length)
      }
      ui.bl.replaceChildren(...out)
    }
    drawFinds()

    // Text and bars: about 10 times a second.
    const text = setInterval(() => {
      if (findsDirty) { findsDirty = false; drawFinds() }
      if (!dirty) return
      dirty = false
      totals.set(0, num(seenCells * cs * cs)); totals.set(1, num(rockCells)); totals.set(2, num(onRouteCells))
      totals.el.children[2].classList.toggle('avoid', onRouteCells > 0) // red only while the walk still has rocks to walk around
      if (landed) { title.textContent = 'Flights complete: your route is ready'; distText.textContent = '' }
      if (!tick) return
      const along = Math.min(tick.along, tick.metres)
      const progress = landed ? 1 : tick.metres ? Math.max(0, Math.min(1, along / tick.metres)) : 0
      dist.set(progress)
      dist.el.setAttribute('aria-valuenow', Math.round(progress * 100))
      dist.el.classList.toggle('is-active', flying)
      if (!landed) distText.textContent = `${Math.round(along)} / ${Math.round(tick.metres)} m`
    }, 100)
    // The map: four times a second.
    const paint = setInterval(() => {
      if (!mapDirty) return
      mapDirty = false
      map.paintScouted()
      drawFindDots()
      map.dots('heli', flying && tick?.x != null ? [{ cell: [tick.x / cs, tick.z / cs], color: SCOUT, ring: '#fff', r: 3.2 * map.scale }] : [])
    }, 250)

    setSpeed(1)
    app.scout.start()
    // If no flight begins (none left, or nothing to scout), do not leave the crew stuck here.
    later(() => {
      if (started) return
      speedRow.hidden = true
      title.textContent = 'No flight to fly'
      next.hidden = false
    }, 5000)

    return () => {
      for (const off of offs) off()
      for (const t of timers) clearTimeout(t)
      clearInterval(text); clearInterval(paint)
      style.remove()
      ui.strip.classList.remove('sc-tl'); ui.bl.classList.remove('sc-finds')
      map.clear('heli'); map.clear('finds')
      app.scout.seconds(null)
    }
  },
}
