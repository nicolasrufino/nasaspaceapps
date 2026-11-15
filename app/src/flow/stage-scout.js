// Stage 3, Scout: third person behind the helicopter while it flies its corridors (docs/UX-PLAN.md section 0).
// The rail says what is happening: this flight, the helicopter's battery (an estimate, see heli-energy.js), a list
// of detections (what was found, where, and what it means for the route) and the scan totals. The mini map,
// bottom right, fills in and carries the same numbers as the list.
// The scan is simulated: rocks come from the stored rock layer (the terrain roughness estimate plus the reviewed
// NASA MRO HiRISE detections, see models.js), not from a live classifier.
import { flightSeconds, batteryLeft, FLIGHT_POWER_W, BATTERY_WH } from './heli-energy.js'
import { MODELS } from './models.js'
import { scoutPayloadEnabled, summarizePayloadFlight, latestWeather, SKYFALL_SOURCE, CAMERA_FOOTPRINT_M } from './scout-payload.js'

const SCOUT = '#e3dfd3', HAZARD = '#c5a065'
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
.sc-payload summary, .sc-record summary { cursor: pointer; font-weight: 600; }
.sc-payload a { color: var(--scout); }
.sc-payload ul { padding-left: 18px; margin: 10px 0; }
.sc-payload li { margin: 8px 0; font-size: 12px; }
.sc-payload li small { display: block; color: var(--mute); }
.sc-record { padding: 8px 0; border-top: 1px solid var(--panel2); }
.sc-record .f-stats { margin: 10px 0; }
`

export default {
  enter(ui, app) {
    ui.scene(true)
    const { map } = ui
    const { cs, W } = app
    const payloadOn = scoutPayloadEnabled(location.search)
    const offs = [], timers = new Set()
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }
    const style = ui.h('style', '', CSS)
    document.head.append(style)
    const num = (v) => Math.round(v).toLocaleString('en-US')
    const signedKj = (j) => { const v = Math.round(j / 1000); return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} kJ` }

    // 1. This flight.
    const flightSec = ui.section(`Flight 1 of ${app.MAX_FLIGHTS ?? 3}`, true)
    const flightTitle = flightSec.querySelector('h2')
    const dist = ui.bar(), distText = ui.h('p', '', 'Taking off')
    dist.el.classList.add('f-flight-progress')
    dist.el.setAttribute('role', 'progressbar')
    dist.el.setAttribute('aria-label', 'Flight progress')
    dist.el.setAttribute('aria-valuemin', '0')
    dist.el.setAttribute('aria-valuemax', '100')
    dist.el.setAttribute('aria-valuenow', '0')
    flightSec.append(ui.h('p', 'dim', 'Simulated scan · stored HiRISE data'), dist.el, distText)

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
    const stripLabel = payloadOn ? `about ${stripM} m, our estimate` : `the ${stripM} m strip the camera sees`
    const legend = ui.h('div', 'sc-legend', `<span><i style="background:${SCOUT}"></i>${stripLabel}</span><span><i style="background:${HAZARD}"></i>rock field: blocks over 0.3 m, walk around</span>`)
    // Why a walker avoids rock fields: NASA ICES-2025-294 step limit; NASA JETT3 2022 (NTRS 20230010686), docs/RESEARCH.md.
    const why = ui.details('Why avoid rock fields?', ...[
      `A rock cell is a ${cs} m square packed with rocks, not one rock. A suited astronaut can’t step over anything higher than 0.3 m (NASA ICES-2025-294), so the walk goes around the whole field.`,
      'Found on foot, a field means an unplanned detour paid from the energy needed to get home. Found from the air, the route goes around it before anyone leaves.',
      'In NASA’s 2022 JETT3 field test, walks ended short on ground the maps missed.',
    ].map((t) => ui.h('p', 'dim', t)))
    scanSec.append(totals.el, legend, why)
    const technical = ui.details('Battery estimate & data sources', heliSec, ui.model(MODELS.scan))
    ui.body.append(flightSec, scanSec, detSec, technical)

    // Payload and landing reports are opt-in. The engine and its event contract
    // stay unchanged; all measurements below read the existing world layers.
    let recordedSec = null, records = null, activeFlight = null
    const weatherAbort = new AbortController()
    if (payloadOn) {
      const payload = ui.section('')
      payload.classList.add('sc-payload')
      const details = ui.h('details', 'f-details', '<summary>SkyFall instruments & limits</summary>')
      details.append(ui.h('p', 'dim', 'Simulated observations from stored data. No live sensor is modelled.'))
      const list = ui.h('ul')
      const instruments = [
        ['Two 13 MP colour cameras', 'Optical + topographic · Simulated: NASA HiRISE / USGS imagery (25 cm) and terrain (1 m) stand in for airborne mapping.'],
        ['Two near-infrared cameras', 'Spectral · Simulated: CRISM orbit data (about 18 m), not helicopter mineral measurements.'],
        ['Ground-penetrating radar', 'Geophysical · Not simulated. NASA expects roughly 3–5 m penetration in low-loss ground.'],
        ['Air temperature + wind from flight', 'Atmospheric · Simulated temperature context: loading Curiosity REMS ground weather. Wind is not simulated.'],
        ['Dosimeter', 'Radiation · Simulated: mean stored RAD-based dose rate in the strip; not a measured 3D radiation map.'],
        ['Two navigation cameras', 'Hazards · Simulated: stored terrain-rule and reviewed HiRISE rock cells; not live camera detection.'],
      ]
      let weatherText
      for (const [name, description] of instruments) {
        const item = ui.h('li'), title = ui.h('b'), descriptionEl = ui.h('small')
        title.textContent = name; descriptionEl.textContent = description
        item.append(title, descriptionEl); list.append(item)
        if (name.startsWith('Air temperature')) weatherText = descriptionEl
      }
      details.append(list,
        ui.h('p', 'dim', 'Contact chemistry and ground thermal imaging are not carried. The crew adds contact measurements at the stop.'),
        ui.h('p', 'dim', `Strip: about ${stripM} m, our estimate. At our assumed 10 m height, NASA’s 106° camera field of view gives about ${CAMERA_FOOTPRINT_M.toFixed(1)} m on flat ground. NASA specifies no flight height here.`),
        ui.h('a', '', 'NASA SkyFall mission package · sections II and IV'))
      const source = details.querySelector('a')
      source.href = SKYFALL_SOURCE; source.target = '_blank'; source.rel = 'noopener noreferrer'
      payload.append(details)
      ui.body.append(payload)
      recordedSec = ui.details('Flight recordings')
      recordedSec.hidden = true
      records = ui.h('div', 'sc-records')
      recordedSec.querySelector('.f-details-body').append(ui.h('p', 'dim', 'Simulated · stored layers over each flight’s full strip. Overlap counts once per flight; these are not newly discovered cells.'), records)
      payload.after(recordedSec)
      const weatherFile = app.meta.files?.weather
      const noWeather = () => { weatherText.textContent = 'Atmospheric · Not simulated: REMS temperature context unavailable. Wind is not simulated.' }
      if (weatherFile) {
        fetch(`${import.meta.env.BASE_URL}${encodeURIComponent(app.meta.name)}/${weatherFile}`, { signal: weatherAbort.signal })
          .then((r) => r.ok ? r.json() : null).then((data) => {
            if (weatherAbort.signal.aborted) return
            const sol = latestWeather(data)
            if (!sol) { noWeather(); return }
            weatherText.textContent = `Atmospheric · Simulated context: Curiosity REMS sol ${sol.sol}, ${sol.min_temp_c} to ${sol.max_temp_c} °C (latest stored daily air range). Historical ground data, not this flight’s weather. Wind is not simulated.`
          }).catch(() => { if (!weatherAbort.signal.aborted) noWeather() })
      } else noWeather()
    }

    function recordFlight(n) {
      if (!payloadOn || !activeFlight || activeFlight.n !== n) return
      const s = summarizePayloadFlight(app.world, activeFlight)
      const percent = (v) => v == null ? 'Unavailable' : `${(100 * v).toFixed(1)}%`
      const report = ui.h('details', 'sc-record')
      report.append(ui.h('summary', '', `Flight ${n} · ${num(s.metres)} m`), ui.stats([
        ['m strip length', num(s.metres)], ['m² grid footprint', num(s.area_m2)],
        ['ridge cells', percent(s.ridge_share)], ['hollow cells', percent(s.hollow_share)],
        ['µGy/h mean dose rate', s.mean_dose_rate_ugy_h == null ? 'Unavailable' : s.mean_dose_rate_ugy_h.toFixed(2)],
        ['rock cells in strip', s.rock_cells == null ? 'Unavailable' : num(s.rock_cells)],
      ]).el, ui.h('p', 'dim', `${num(s.cells)} unique ${cs} m grid cells. Landform: ${num(s.landform_samples)} valid cells; dose rate: ${num(s.dose_samples)}; hazards: ${num(s.rock_samples)}. Landforms come from USGS/HiRISE terrain; radiation from the Curiosity RAD-based layer. Dose rate is not accumulated flight dose.`))
      for (const previous of records.children) previous.open = false
      records.prepend(report)
      recordedSec.hidden = false
      activeFlight = null
    }

    // Foot: speed.
    let speed = NORMAL_S, skipped = false
    const fast = ui.button('2× speed', () => {
      if (skipped) return
      speed = speed === NORMAL_S ? FAST_S : NORMAL_S
      app.scout.seconds(speed)
      fast.setAttribute('aria-pressed', speed === FAST_S)
    })
    fast.setAttribute('aria-pressed', false)
    fast.setAttribute('aria-label', 'Fly at double speed')
    const skip = ui.button('Finish flights', () => { skipped = true; app.scout.seconds(SKIP_S); fast.disabled = skip.disabled = true })
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
    let tick = null, flying = false, started = false, dirty = false, mapDirty = false, findsDirty = true, campaignLanded = false
    let seenCells = 0, rockCells = 0, onRouteCells = 0, hot = null
    const finds = [] // { n, flight, along, cells, onRoute, cell, result }
    let cur = null, lastRockAlong = -Infinity, lastRockFlight = 0

    offs.push(app.on('flight:start', (e) => {
      started = flying = true
      tick = { ...e, along: 0 }
      if (payloadOn) activeFlight = e
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
      recordFlight(n)
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
      if (payloadOn) {
        campaignLanded = true
        ui.foot.replaceChildren(ui.button('Review the walk', () => ui.go('debrief'), true))
      } else later(() => ui.go('debrief'), 1500)
    }))

    function drawFindDots() {
      const k = map.scale
      map.dots('finds', finds.map((f) => ({ cell: f.cell, label: f.n, color: HAZARD, ring: f.n === hot ? '#fff' : '#191919', r: (f.n === hot ? 4.2 : 3.2) * k })))
    }
    function drawFinds() {
      detTitle.textContent = `Detections · ${finds.length}`
      if (!finds.length) {
        detList.replaceChildren(Object.assign(ui.h('p', 'dim'), { textContent: 'Scanning for rocks…' }))
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
      const progress = tick.metres ? Math.max(0, Math.min(1, along / tick.metres)) : 0
      dist.set(progress)
      dist.el.setAttribute('aria-valuenow', Math.round(progress * 100))
      dist.el.classList.toggle('is-active', flying)
      distText.textContent = campaignLanded ? 'Flights complete. Your route is ready.' : `${Math.round(along)} / ${Math.round(tick.metres)} m`
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
      weatherAbort.abort()
      for (const off of offs) off()
      for (const t of timers) clearTimeout(t)
      clearInterval(text); clearInterval(paint)
      style.remove()
      map.clear('heli'); map.clear('finds')
      app.scout.seconds(null)
    }
  },
}
