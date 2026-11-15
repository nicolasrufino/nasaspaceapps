// Stage 1: select stops on the NASA HiRISE map or with explicit add/remove buttons.
// Selection, route preferences and calculations still belong to the existing app bridge.
import { scienceGoalOn, goalCard, stopCheck, loadCandidates, goalsOn, goalsSection } from './goal.js'
import { findButton } from './find.js'
const MIN_STOPS = 3

export default {
  enter(ui, app) {
    const { map } = ui
    map.caption('Choose your stops', 'NASA MRO HiRISE · USGS Gale mosaic · tap the map to add a stop')
    map.fit([app.meta.base_cell, ...app.stops().map((s) => s.cell)], 20)

    const goal = scienceGoalOn()
    const intro = ui.section('Choose your stops', true)
    intro.append(Object.assign(ui.h('p', 'dim'), { textContent: 'Pick at least 3. Use + below or tap the map.' }))
    const sug = ui.section(goal ? 'Curiosity stops' : 'Suggested stops'), sugList = ui.h('div', 'f-list f-stop-list')
    const addAll = ui.button('+ Add all', () => {
      for (const s of app.stops()) if (!s.custom && !s.included) app.toggleStop(s.id)
    })
    addAll.classList.add('f-compact')
    addAll.setAttribute('aria-label', 'Add all suggested stops')
    const sugHead = ui.h('div', 'f-section-head')
    sugHead.append(sug.querySelector('h3'), addAll)
    sug.append(sugHead, sugList)

    const mine = ui.section('Added on the map'), mineList = ui.h('div', 'f-list')
    mine.append(mineList)

    const how = ui.section('Route preference'), seg = ui.h('div', 'f-seg')
    const btn = { easiest: ui.button('Least energy', () => app.setObjective('easiest')), shortest: ui.button('Shortest', () => app.setObjective('shortest')) }
    btn.easiest.title = 'Spend less walking energy; avoid sand and steep ground.'
    btn.shortest.title = 'Minimise distance on walkable ground.'
    seg.append(btn.easiest, btn.shortest)
    how.append(seg)

    const reasons = ui.h('div', 'f-list')
    for (const s of app.stops().filter((s) => !s.custom)) reasons.append(ui.item({ title: s.name, sub: s.why ?? s.goal ?? '' }))
    const more = ui.details('More options & stop details', reasons)
    const goals = goal && goalsOn()
    const addCurio = () => { for (const s of app.stops()) if (!s.custom && !s.included) app.toggleStop(s.id) }
    const gc = goals ? goalsSection(ui, (id, note) => {
      if (id === 'boxwork') return picks.length ? addCands() : (note.textContent = 'Boxwork sites are still loading.')
      // ponytail: groundwater adds Curiosity's 5 stops: neutron_points.json has a DAN reading on each stop's sol (stops.json). Orbit-ranked cells are the upgrade.
      addCurio(); note.textContent = 'Added Curiosity’s stops: DAN measured hydrogen on each stop’s sol. A guide; the crew decides.'
    }) : goal ? goalCard(ui) : null
    if (goals) sug.querySelector('h3').textContent = 'Or pick Curiosity’s stops'
    ui.body.append(intro, ...(gc ? [gc] : []), sug, mine, how, more)
    let addCands = () => {}

    // Optional candidate sites keep their existing evidence and action, under More options.
    let picks = [], live = true, closeFind = null
    if (goal) loadCandidates().then((c) => {
      if (!live || !c.length) return
      picks = c
      const sec = ui.section('Sites the map suggests')
      sec.append(Object.assign(ui.h('p', 'dim'), { textContent: 'Ranked from ridges and hollows in the 1 m HiRISE terrain. A guide; the crew decides.' }),
        ui.button(`+ Add ${c.length} candidate sites`, () => addCands()))
      more.querySelector('.f-details-body').prepend(sec)
      addCands = () => {
        const have = new Set(app.stops().filter((s) => s.included).map((s) => `${s.cell}`))
        for (const p of c) if (!have.has(`${p.cell}`)) { app.addStop(p.cell); have.add(`${p.cell}`) }
      }
      // "How the map finds boxwork" (find.js), right after the science goal; hidden by ?off=find or a missing file.
      findButton(ui, app, c, () => addCands()).then((f) => { if (live && f) { gc.after(f.el); closeFind = f.close } })
    })

    const go = ui.button('Plan the route', () => ui.go('analyse'), true)
    const hint = ui.h('div', 'f-selection-count')
    hint.setAttribute('role', 'status')
    ui.foot.append(hint, go)

    let hot = null
    function hover(id, v) {
      hot = v ? id : null
      drawPins() // Hover never replaces the button under the pointer.
    }
    function drawPins() {
      const stops = app.stops(), on = stops.filter((s) => s.included), off = stops.filter((s) => !s.included && !s.custom)
      const k = map.scale
      map.dots('stops', [
        { id: 'base', cell: app.meta.base_cell, label: 'H', color: '#fff', r: 1.7 * k },
        ...off.map((s) => ({ id: s.id, cell: s.cell, label: '+', color: '#f3f2ef', r: (s.id === hot ? 1.9 : 1.6) * k, faded: s.id !== hot })),
        ...on.map((s, n) => ({ id: s.id, cell: s.cell, label: n + 1, color: '#ffd23f', r: (s.id === hot ? 2.1 : 1.7) * k })),
      ], (id) => { if (id !== 'base') app.toggleStop(id) })
    }
    function draw() {
      const stops = app.stops(), on = stops.filter((s) => s.included), suggestions = stops.filter((s) => !s.custom)
      drawPins()
      const focused = sugList.contains(document.activeElement) ? document.activeElement.dataset.stopId : null
      sugList.replaceChildren(...suggestions.map((s) => {
        const row = ui.item({ n: s.included ? on.indexOf(s) + 1 : '+', title: s.name,
          sub: goal ? stopCheck(s.id) : '', onClick: () => app.toggleStop(s.id), onHover: (v) => hover(s.id, v) })
        row.dataset.stopId = s.id
        row.classList.toggle('selected', s.included)
        row.setAttribute('aria-pressed', s.included)
        row.setAttribute('aria-label', `${s.included ? 'Remove' : 'Add'} ${s.name}`)
        row.title = s.why ?? s.name
        const action = ui.h('span', 'f-stop-action')
        action.textContent = s.included ? '✓' : 'Add'
        action.setAttribute('aria-hidden', 'true')
        row.append(action)
        return row
      }))
      if (focused) [...sugList.children].find((row) => row.dataset.stopId === focused)?.focus({ preventScroll: true })
      const custom = on.filter((s) => s.custom)
      mine.hidden = !custom.length
      mineList.replaceChildren(...custom.map((s) => ui.item({ n: on.indexOf(s) + 1, title: s.name,
        sub: picks.some((p) => `${p.cell}` === `${s.cell}`) ? 'Map candidate' : 'Picked on the map',
        onRemove: () => app.removeStop(s.id), onHover: (v) => hover(s.id, v) })))
      addAll.disabled = suggestions.every((s) => s.included)
      addAll.textContent = addAll.disabled ? 'All added ✓' : '+ Add all'
      const o = app.objective()
      btn.easiest.setAttribute('aria-pressed', o === 'easiest'); btn.shortest.setAttribute('aria-pressed', o === 'shortest')
      go.disabled = on.length < MIN_STOPS
      hint.textContent = on.length < MIN_STOPS ? `${on.length} selected · add ${MIN_STOPS - on.length} more` : `${on.length} stops selected · ready to plan`
      hint.classList.toggle('ready', !go.disabled)
    }
    map.onTap((cell) => app.addStop(cell))
    const off = app.on('plan', draw)
    draw()
    return () => { live = false; off(); closeFind?.() }
  },
}
