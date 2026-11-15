// Stage 3, Scout: third person behind the helicopter while it flies its corridors (docs/UX-PLAN.md section 0).
// The rail says what is happening: this flight, the helicopter's battery (an estimate, see heli-energy.js), a list
// of detections (what was found, where, and what it means for the route) and the scan totals. The mini map,
// bottom right, fills in and carries the same numbers as the list.
// The scan is simulated: rocks come from the stored rock layer (the terrain roughness estimate plus the reviewed
// NASA MRO HiRISE detections, see models.js), not from a live classifier.
import { flightSeconds, batteryLeft, FLIGHT_POWER_W, BATTERY_WH } from './heli-energy.js'
import { MODELS } from './models.js'

const SCOUT = '#35e0ff', HAZARD = '#ff5a3d'
const NORMAL_S = 40, FAST_S = 20, SKIP_S = 1.5 // screen seconds per flight
const FIND_GAP_M = 40 // rocks after this much flight without any start a new find
const MAX_ROWS = 5

const CSS = `
.sc-find .n { background: var(--hazard); }
.sc-find.on-route .t small { color: var(--hazard); }
.sc-find { padding: 6px 0; }
.sc-legend { display: grid; gap: 4px; margin: 10px 0; font-size: 12px; color: var(--mute); }
.sc-legend span { display: flex; gap: 8px; align-items: center; }
.sc-legend i { flex: none; width: 14px; height: 8px; border-radius: 2px; }
`

export default {
  enter(ui, app) {
    ui.scene(true)
    const { map } = ui
    const { cs, W } = app
    const offs = [], timers = new Set()
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }
    const style = ui.h('style', '', CSS)
    document.head.append(style)
    const num = (v) => Math.round(v).toLocaleString('en-US')
    const signedKj = (j) => { const v = Math.round(j / 1000); return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} kJ` }

    // 1. This flight.
    const flightSec = ui.section(`Flight 1 of ${app.MAX_FLIGHTS ?? 3}`)
    const flightTitle = flightSec.querySelector('h3')
    const dist = ui.bar(), distText = ui.h('p', '', 'Taking off')
    flightSec.append(dist.el, distText)

    // 2. The helicopter (estimates from heli-energy.js).
    const heliSec = ui.section('Helicopter')
    const heli = ui.stats([['% battery, estimate', '100', 'scout'], ['seconds in the air, estimate', '0']])
    const batt = ui.bar()
    batt.set(1)
    heliSec.append(heli.el, batt.el, ui.h('div', 'f-small', `Estimate: Ingenuity's ${FLIGHT_POWER_W} W and ${BATTERY_WH} Wh battery (NASA/JPL) on SkyFall's 1 km in 2.5 min.`))

    // 3. Detections: one row per find, newest on top.
    const detSec = ui.section('Detections · 0')
    const detTitle = detSec.querySelector('h3'), detList = ui.h('div', 'f-list')
    detSec.append(detList)

    // 4. Scan totals, legend, model card.
    const scanSec = ui.section('Scan')
    const totals = ui.stats([['m² of ground scanned', '0', 'scout'], ['rock cells found', '0', 'hazard'], ['on the route', '0', 'hazard']])
    const stripM = Math.round(2 * (app.scout.swathM ?? 15))
    const legend = ui.h('div', 'sc-legend', `<span><i style="background:${SCOUT}"></i>the ${stripM} m strip the camera sees</span><span><i style="background:${HAZARD}"></i>rocks too big to step over (over 0.3 m)</span>`)
    scanSec.append(totals.el, legend, ui.model(MODELS.scan))
    ui.body.append(flightSec, heliSec, detSec, scanSec)

    // Foot: speed.
    let speed = NORMAL_S, skipped = false
    const fast = ui.button('2×', () => {
      if (skipped) return
      speed = speed === NORMAL_S ? FAST_S : NORMAL_S
      app.scout.seconds(speed)
      fast.setAttribute('aria-pressed', speed === FAST_S)
    })
    fast.setAttribute('aria-pressed', false)
    fast.setAttribute('aria-label', 'Fly at double speed')
    const skip = ui.button('Skip', () => { skipped = true; app.scout.seconds(SKIP_S); fast.disabled = skip.disabled = true })
    skip.setAttribute('aria-label', 'Skip to the end of the flights')
    const row = ui.h('div', 'f-row')
    row.append(fast, skip)
    ui.foot.append(row)

    // Main area: the mini map, bottom right.
    map.size('mini')
    map.caption('Seen so far')
    map.clear()
    ui.br.append(map.el)
    const stopCells = () => app.stops().filter((s) => s.included && !s.dropped).map((s) => s.cell)
    let routeSet = new Set()
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
    let tick = null, flying = false, started = false, dirty = false, mapDirty = false, findsDirty = true
    let seenCells = 0, rockCells = 0, onRouteCells = 0, hot = null
    const finds = [] // { n, flight, along, cells, onRoute, cell, result }
    let cur = null, lastRockAlong = -Infinity, lastRockFlight = 0

    offs.push(app.on('flight:start', (e) => {
      started = flying = true
      tick = { ...e, along: 0 }
      flightTitle.textContent = `Flight ${e.n} of ${e.of}`
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
        cur = { n: finds.length + 1, flight: e.n, along: e.along, cells: 0, onRoute: 0, cell: [i % W, Math.floor(i / W)], result: '' }
        finds.push(cur)
      }
      lastRockAlong = e.along; lastRockFlight = e.n
      const hit = rocks.filter((i) => routeSet.has(i)).length // the route as it is now, before any re-plan
      cur.cells += rocks.length; cur.onRoute += hit
      rockCells += rocks.length; onRouteCells += hit
      findsDirty = mapDirty = true
    }))
    offs.push(app.on('flight:end', ({ n, summary }) => {
      const s = summary ?? {}
      flying = false
      cur = null
      const kj = Math.round((s.energy_delta_j ?? 0) / 1000) ? `, ${signedKj(s.energy_delta_j)}` : ''
      const moved = s.avoided_cells ? 'route moved' : 'route unchanged'
      const hits = finds.filter((f) => f.flight === n && f.onRoute)
      for (const f of hits) f.result = s.avoided_cells ? `route moved${kj}${kj && hits.length > 1 ? ' with the others in this flight' : ''}` : 'route unchanged'
      const rocks = s.found_cells ? `${s.found_cells} rock cells found` : 'no rocks found'
      ui.event(`Flight ${n} landed. ${rocks}, ${moved}${kj}.`, { hazard: !!s.avoided_cells, ms: 4000 })
      if (tick) tick = { ...tick, along: tick.metres }
      dirty = mapDirty = findsDirty = true
    }))
    offs.push(app.on('plan', () => { drawRoute(); map.raise('finds'); map.raise('heli'); mapDirty = true }))
    offs.push(app.on('landed', () => {
      flying = false
      dirty = mapDirty = true
      later(() => ui.go('debrief'), 1500)
    }))

    function drawFindDots() {
      const k = map.scale
      map.dots('finds', finds.map((f) => ({ cell: f.cell, label: f.n, color: HAZARD, ring: f.n === hot ? '#fff' : '#191919', r: (f.n === hot ? 4.2 : 3.2) * k })))
    }
    function drawFinds() {
      detTitle.textContent = `Detections · ${finds.length}`
      if (!finds.length) {
        detList.replaceChildren(Object.assign(ui.h('p', 'dim'), { textContent: 'None yet. Rocks are listed here as the camera passes over them.' }))
        return
      }
      const rows = finds.slice(-MAX_ROWS).reverse().map((f) => {
        const where = `${Math.round(f.along)} m into flight ${f.flight}`
        const means = f.onRoute ? `on the route${f.result ? `: ${f.result}` : ''}` : 'off the route'
        const e = ui.item({ n: f.n, title: `Rock field · ${f.cells} ${f.cells === 1 ? 'cell' : 'cells'}, about ${num(f.cells * cs * cs)} m²`, sub: `${where} · ${means}`,
          onHover: (v) => { hot = v ? f.n : null; drawFindDots() } })
        e.classList.add('sc-find')
        if (f.onRoute) e.classList.add('on-route')
        return e
      })
      const earlier = finds.length - rows.length
      if (earlier > 0) rows.push(Object.assign(ui.h('p', 'dim'), { textContent: `and ${earlier} earlier` }))
      detList.replaceChildren(...rows)
    }
    drawFinds()

    // Text and bars: about 10 times a second.
    const text = setInterval(() => {
      if (findsDirty) { findsDirty = false; drawFinds() }
      if (!dirty) return
      dirty = false
      totals.set(0, num(seenCells * cs * cs)); totals.set(1, num(rockCells)); totals.set(2, num(onRouteCells))
      if (!tick) return
      const along = Math.min(tick.along, tick.metres)
      dist.set(tick.metres ? along / tick.metres : 0)
      distText.textContent = `${Math.round(along)} m of ${Math.round(tick.metres)} m`
      const left = batteryLeft(along)
      heli.set(0, Math.round(left * 100)); heli.set(1, Math.round(flightSeconds(along)))
      batt.set(left)
    }, 100)
    // The map: four times a second.
    const paint = setInterval(() => {
      if (!mapDirty) return
      mapDirty = false
      map.paintScouted()
      drawFindDots()
      map.dots('heli', flying && tick?.x != null ? [{ cell: [tick.x / cs, tick.z / cs], color: SCOUT, ring: '#fff', r: 3.2 * map.scale }] : [])
    }, 250)

    app.scout.seconds(NORMAL_S)
    app.scout.start()
    // If no flight begins (none left, or nothing to scout), do not leave the crew stuck here.
    later(() => {
      if (started) return
      fast.disabled = skip.disabled = true
      distText.textContent = 'No flight to fly.'
      ui.foot.append(ui.button('Continue', () => ui.go('debrief'), true))
    }, 5000)

    return () => {
      for (const off of offs) off()
      for (const t of timers) clearTimeout(t)
      clearInterval(text); clearInterval(paint)
      style.remove()
      map.clear('heli'); map.clear('finds')
      app.scout.seconds(null)
    }
  },
}
