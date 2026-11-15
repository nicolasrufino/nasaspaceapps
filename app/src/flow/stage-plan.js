// Stage 1, Choose stops: inside the habitat, at the console. The orbit picture is all the crew has. It starts empty:
// tap the map or pick a suggested stop; three or more, then "Plan the route". Nothing is worked out yet, so no
// route line and no numbers are shown here (docs/UX-PLAN.md section 0).
const MIN_STOPS = 3

export default {
  enter(ui, app) {
    const { map } = ui
    map.caption('What we know from orbit', 'NASA MRO HiRISE colour · USGS MSL Gale mosaic · tap to add a stop')
    map.fit()

    const intro = ui.section('Where do you want to go?', true)
    intro.append(Object.assign(ui.h('p', 'dim'), { textContent: 'You are in the habitat. Pick the places worth the walk: tap the map, or take the science team’s suggestions.' }))
    const how = ui.section('How to walk it')
    const seg = ui.h('div', 'f-seg')
    const btn = { easiest: ui.button('Easiest', () => app.setObjective('easiest')), shortest: ui.button('Shortest', () => app.setObjective('shortest')) }
    seg.append(btn.easiest, btn.shortest)
    const note = ui.h('p', 'dim')
    note.style.marginTop = '8px'
    how.append(seg, note)
    const mine = ui.section(''), mineList = ui.h('div', 'f-list')
    mine.append(ui.h('h3'), mineList)
    const sug = ui.section('Suggested by the science team'), sugList = ui.h('div', 'f-list')
    sug.append(sugList)
    ui.body.append(intro, how, mine, sug)

    const go = ui.button('Plan the route', () => ui.go('analyse'), true)
    const hint = ui.h('div', 'f-small')
    ui.foot.append(hint, go)

    let hot = null
    function draw() {
      const stops = app.stops(), on = stops.filter((s) => s.included), off = stops.filter((s) => !s.included && !s.custom)
      const k = map.scale
      map.dots('stops', [
        { id: 'base', cell: app.meta.base_cell, label: 'H', color: '#fff', r: 1.7 * k },
        ...off.map((s) => ({ id: s.id, cell: s.cell, label: '+', color: '#f3f2ef', r: (s.id === hot ? 1.9 : 1.4) * k, faded: s.id !== hot })),
        ...on.map((s, n) => ({ id: s.id, cell: s.cell, label: n + 1, color: '#ffd23f', r: (s.id === hot ? 2.1 : 1.7) * k })),
      ], (id) => { if (id !== 'base') app.toggleStop(id) })
      mine.querySelector('h3').textContent = on.length >= MIN_STOPS ? `Your stops · ${on.length}` : `Your stops · ${on.length} of ${MIN_STOPS} needed`
      mineList.replaceChildren(...on.map((s, n) => ui.item({ n: n + 1, title: s.name, sub: s.custom ? 'Picked on the map' : s.goal ?? '', onRemove: () => app.removeStop(s.id), onHover: (v) => { hot = v ? s.id : null; draw() } })))
      if (!on.length) mineList.append(Object.assign(ui.h('p', 'dim'), { textContent: 'None yet.' }))
      sugList.replaceChildren(...off.map((s) => ui.item({ title: s.name, sub: s.why ?? '', onClick: () => app.toggleStop(s.id), onHover: (v) => { hot = v ? s.id : null; draw() } })))
      sug.hidden = !off.length
      const o = app.objective()
      btn.easiest.setAttribute('aria-pressed', o === 'easiest'); btn.shortest.setAttribute('aria-pressed', o === 'shortest')
      note.textContent = o === 'easiest' ? 'Least energy: around sand and steep ground.' : 'Least distance, whatever the ground.'
      go.disabled = on.length < MIN_STOPS
      hint.textContent = on.length < MIN_STOPS ? `Choose at least ${MIN_STOPS} stops.` : 'Next: see how the route is worked out.'
    }
    map.onTap((cell) => app.addStop(cell))
    const off = app.on('plan', draw)
    draw()
    return off
  },
}
