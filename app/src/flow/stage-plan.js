// Stage 1: pick a science goal, and its stops are added at once; tap the map to add or remove more.
// One list (the stops you have), one way to add (goal or map), one way to remove (×). The science behind each goal
// lives on the docs page, not here (DECISIONS 2026-11-15). Selection and planning belong to the app bridge.
import { loadCandidates } from './goal.js'
const MIN_STOPS = 3
let chosen = null // the goal picked, kept when the user comes back to this stage

export default {
  enter(ui, app) {
    const { map } = ui
    map.caption('Mount Sharp from orbit', 'NASA MRO HiRISE · USGS Gale mosaic')
    map.fit([app.meta.base_cell, ...app.stops().map((s) => s.cell)], 20)

    const curio = () => app.stops().filter((s) => !s.custom)
    let picks = [] // candidates.json: the boxwork sites the map ranks
    const fromMap = (s) => picks.find((p) => `${p.cell}` === `${s.cell}`)

    // Choosing a goal swaps in its stops; stops the user tapped on the map stay.
    function choose(id) {
      chosen = id
      for (const s of app.stops()) {
        if (!s.included) continue
        if (!s.custom && id !== 'water') app.toggleStop(s.id)
        if (s.custom && fromMap(s) && id !== 'boxwork') app.removeStop(s.id)
      }
      if (id === 'water') for (const s of curio()) { if (!s.included) app.toggleStop(s.id) }
      else {
        const have = new Set(app.stops().filter((s) => s.included).map((s) => `${s.cell}`))
        for (const p of picks) if (!have.has(`${p.cell}`)) app.addStop(p.cell)
      }
      draw()
    }

    const intro = ui.section('Pick a science goal', true)
    const cards = ui.h('div', 'f-goal-cards')
    const card = (id, name) => {
      const b = ui.h('button', 'f-goal-card', '<b></b><small></small>')
      b.type = 'button'; b.firstChild.textContent = name; b.onclick = () => choose(id)
      cards.append(b)
      return b
    }
    const water = card('water', 'Groundwater'), box = card('boxwork', 'Boxwork')
    water.lastChild.textContent = `Visit Curiosity’s ${curio().length} stops`
    box.lastChild.textContent = 'Loading sites…'; box.disabled = true
    intro.append(cards)

    const mine = ui.section(''), head = ui.h('div', 'f-section-head'), list = ui.h('div', 'f-list f-stops')
    head.innerHTML = '<h3></h3><span class="f-small">or tap the map</span>'
    mine.append(head, list)
    ui.body.append(intro, mine)

    let live = true
    loadCandidates().then((c) => {
      if (!live) return
      picks = c
      box.disabled = !c.length
      box.lastChild.textContent = c.length ? `Visit ${c.length} sites ranked from orbit` : 'No sites found'
      draw()
    })

    const go = ui.button('Plan the route', () => ui.go('analyse'), true)
    const hint = ui.h('div', 'f-selection-count')
    hint.setAttribute('role', 'status')
    ui.foot.append(hint, go)

    let hot = null
    const hover = (id, v) => { hot = v ? id : null; drawPins() }
    function drawPins() {
      const stops = app.stops(), on = stops.filter((s) => s.included), off = stops.filter((s) => !s.included && !s.custom)
      const k = map.scale
      map.dots('stops', [
        { id: 'base', cell: app.meta.base_cell, label: 'H', color: '#fff', r: 1.7 * k },
        ...off.map((s) => ({ id: s.id, cell: s.cell, label: '+', color: '#f3f2ef', r: (s.id === hot ? 1.9 : 1.6) * k, faded: s.id !== hot })),
        ...on.map((s, n) => ({ id: s.id, cell: s.cell, label: n + 1, color: '#ffd23f', r: (s.id === hot ? 2.1 : 1.7) * k })),
      ], (id) => { if (id === 'base') return; const s = stops.find((x) => x.id === id); s?.custom ? app.removeStop(id) : app.toggleStop(id) })
    }
    function draw() {
      const on = app.stops().filter((s) => s.included)
      drawPins()
      water.setAttribute('aria-pressed', chosen === 'water'); box.setAttribute('aria-pressed', chosen === 'boxwork')
      head.firstChild.textContent = on.length ? `Your stops · ${on.length}` : 'Your stops'
      list.replaceChildren(...on.map((s, n) => ui.item({ n: n + 1, title: fromMap(s)?.name ?? s.name,
        onRemove: () => (s.custom ? app.removeStop(s.id) : app.toggleStop(s.id)), onHover: (v) => hover(s.id, v) })))
      go.disabled = on.length < MIN_STOPS
      const more = MIN_STOPS - on.length
      hint.textContent = on.length ? `Add ${more} more stop${more === 1 ? '' : 's'}` : `Pick a goal, or tap ${MIN_STOPS} spots on the map`
      hint.hidden = !go.disabled
    }
    map.onTap((cell) => app.addStop(cell))
    const off = app.on('plan', draw)
    draw()
    return () => { live = false; off() }
  },
}
