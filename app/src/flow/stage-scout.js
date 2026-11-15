// Stage 3, Scout: third person behind the helicopter while it flies its corridors. The HUD shows one fact at a time:
// how far this flight is, what the helicopter's battery is doing (an estimate, see heli-energy.js), what has been
// found, and the 2D map filling in. The scan is simulated: rocks come from the hidden-rock layer, not a live classifier.
import { flightSeconds, batteryLeft, FLIGHT_POWER_W, BATTERY_WH } from './heli-energy.js'

const SCOUT = '#35e0ff', NORMAL_S = 40, FAST_S = 20, SKIP_S = 1.5

export default {
  enter(ui, app) {
    const { map } = ui
    const offs = [], timers = new Set()
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t) }

    // Left: this flight, then the helicopter.
    const flightCard = ui.card(`Flight 1 of ${app.MAX_FLIGHTS}`)
    const title = flightCard.querySelector('h3')
    const dist = ui.bar(), distText = ui.h('p', '', 'Taking off')
    flightCard.append(dist.el, distText)

    const heliCard = ui.card('Helicopter')
    const heli = ui.stats([['% battery, estimate', '100', 'scout'], ['seconds in the air', '0'], ['watts', '0']])
    const batt = ui.bar()
    const heliNote = ui.h('div', 'f-small', `Estimate: Ingenuity's ${FLIGHT_POWER_W} W and ${BATTERY_WH} Wh battery (NASA/JPL) on SkyFall's 1 km in 2.5 min.`)
    heliCard.append(heli.el, batt.el, heliNote)
    batt.set(1)
    ui.left.append(flightCard, heliCard)

    // Right: what scouting has changed so far.
    const foundCard = ui.card('Found so far')
    const totals = ui.stats([['rock cells found', '0', 'hazard'], ['route cells avoided', '0', 'scout'], ['kJ change to the walk', '0']])
    foundCard.append(totals.el, ui.h('div', 'f-small', 'Simulated scan: the rocks come from the hidden-rock layer, not a live classifier.'))
    foundCard.lastChild.style.marginTop = '10px'
    ui.right.append(foundCard)

    // Bottom right: the map filling in.
    map.size('mini')
    map.caption('Seen so far')
    map.clear()
    ui.br.append(map.el)
    const stopCells = () => app.stops().filter((s) => s.included && !s.dropped).map((s) => s.cell)
    function drawRoute() {
      const k = map.scale
      map.line('route', app.route().cells, { color: '#fff', width: 2.4 * k })
      map.dots('stops', [{ cell: app.meta.base_cell, color: '#fff', r: 4.5 * k }, ...stopCells().map((cell) => ({ cell, r: 4 * k }))])
    }
    map.fit([app.meta.base_cell, ...app.route().cells, ...stopCells()], 16)
    drawRoute()
    map.paintScouted()

    // Bottom left: speed.
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
    ui.bl.append(fast, skip)

    // Live state: written by the events, drawn by the two timers below (not on every frame).
    let tick = null, flying = false, dirty = false, started = false
    let found = 0, avoided = 0, deltaJ = 0, lastRockLine = 0, mapDirty = false
    const signedKj = (j) => { const v = Math.round(j / 1000); return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}` }

    offs.push(app.on('flight:start', (e) => {
      started = flying = true
      tick = { ...e, along: 0 }
      title.textContent = `Flight ${e.n} of ${e.of}`
      dirty = true
    }))
    offs.push(app.on('flight:tick', (e) => {
      tick = e
      dirty = mapDirty = true
      if (e.found > found) {
        found = e.found
        const now = performance.now()
        if (now - lastRockLine > 3000) { lastRockLine = now; ui.event(`Rocks found. ${found} cells so far.`, { hazard: true, ms: 2600 }) }
      }
    }))
    offs.push(app.on('flight:end', ({ n, summary: s }) => {
      flying = false
      avoided += s.avoided_cells ?? 0
      deltaJ += s.energy_delta_j ?? 0
      totals.set(1, avoided); totals.set(2, signedKj(deltaJ))
      const rocks = s.found_cells ? `${s.found_cells} rock cells found` : 'no rocks found'
      const moved = s.avoided_cells ? 'route moved' : 'route unchanged'
      const kj = Math.round((s.energy_delta_j ?? 0) / 1000)
      ui.event(`Flight ${n} landed. ${rocks}, ${moved}${kj ? `, ${signedKj(s.energy_delta_j)} kJ` : ''}.`, { hazard: !!s.avoided_cells, ms: 4000 })
      if (tick) tick = { ...tick, along: tick.metres }
      dirty = mapDirty = true
    }))
    offs.push(app.on('plan', () => { drawRoute(); mapDirty = true }))
    offs.push(app.on('landed', (e) => {
      flying = false
      found = Math.max(found, e.found ?? 0)
      dirty = mapDirty = true
      later(() => ui.go('debrief'), 1500)
    }))

    // Text and bars: about 10 times a second.
    const text = setInterval(() => {
      if (!dirty) return
      dirty = false
      totals.set(0, found)
      if (!tick) return
      const along = Math.min(tick.along, tick.metres)
      dist.set(tick.metres ? along / tick.metres : 0)
      distText.textContent = `${Math.round(along)} m of ${Math.round(tick.metres)} m`
      const left = batteryLeft(along)
      heli.set(0, Math.round(left * 100)); heli.set(1, Math.round(flightSeconds(along))); heli.set(2, flying ? FLIGHT_POWER_W : 0)
      batt.set(left)
    }, 100)
    // The map: four times a second.
    const paint = setInterval(() => {
      if (!mapDirty) return
      mapDirty = false
      map.paintScouted()
      const k = map.scale
      map.dots('heli', flying && tick?.x != null ? [{ cell: [tick.x / app.cs, tick.z / app.cs], color: SCOUT, ring: '#fff', r: 4.5 * k }] : [])
    }, 250)

    app.scout.seconds(NORMAL_S)
    app.scout.start()
    // If no flight begins (none left, or nothing to scout), do not leave the crew stuck here.
    later(() => { if (!started && !app.scout.flying()) ui.bottom.append(ui.button('Continue', () => ui.go('debrief'), true)) }, 4000)

    return () => {
      for (const off of offs) off()
      for (const t of timers) clearTimeout(t)
      clearInterval(text); clearInterval(paint)
      map.clear('heli')
      app.scout.seconds(null)
    }
  },
}
