// Stage 1, Plan: at the habitat. Choose the science stops on the orbit map and how to walk them, then send the scout.
export default {
  enter(ui, app) {
    app.camera('habitat')
    const { map } = ui
    map.size('big')
    map.caption('What we know from orbit', 'Tap a pin to drop or add a stop · tap the map to add your own · NASA MRO HiRISE')
    ui.center.append(map.el)

    const how = ui.card('How should we walk it?')
    const seg = ui.h('div', 'f-seg')
    const btn = { easiest: ui.button('Easiest', () => app.setObjective('easiest')), shortest: ui.button('Shortest', () => app.setObjective('shortest')) }
    seg.append(btn.easiest, btn.shortest)
    const note = ui.h('p')
    how.append(seg, note)

    const numbers = ui.card('This walk')
    const stats = ui.stats([['metres', '0'], ['kJ of walking', '0'], ['minutes', '0']])
    const budget = ui.bar(), budgetNote = ui.h('p')
    numbers.append(stats.el, budget.el, budgetNote)

    const stopCard = ui.card('Science stops')
    const stopNote = ui.h('p')
    stopCard.append(stopNote)
    ui.left.append(how, numbers)
    ui.right.append(stopCard)

    const send = ui.button('Send the scout', () => ui.go('analyse'), true)
    ui.bottom.append(send)

    function draw() {
      const route = app.route(), stops = app.stops(), d = app.describe(route.cells)
      map.clear()
      map.fit([app.meta.base_cell, ...stops.map((s) => s.cell)], 18)
      const k = map.scale
      map.line('route', route.cells, { color: '#fff', width: 2.2 * k })
      map.dots('stops', [
        { id: 'base', cell: app.meta.base_cell, label: 'H', color: '#fff', r: 7 * k },
        ...stops.map((s, n) => ({ id: s.id, cell: s.cell, label: n + 1, r: 7 * k, faded: !s.included, color: s.dropped && s.included ? '#ff5a3d' : s.custom ? '#ff9f1c' : '#ffd23f' })),
      ], (id) => { if (id === 'base') return; pick(id); app.toggleStop(id) })
      stats.set(0, Math.round(d.metres)); stats.set(1, ui.kj(route.energy_j)); stats.set(2, Math.round(route.minutes))
      budget.set(route.energy_j / app.usableJ)
      budgetNote.textContent = `${Math.round((route.energy_j / app.usableJ) * 100)}% of the ${ui.kj(app.usableJ)} kJ the suit can spend on walking, with the reserve kept.`
      const o = app.objective()
      btn.easiest.setAttribute('aria-pressed', o === 'easiest'); btn.shortest.setAttribute('aria-pressed', o === 'shortest')
      note.textContent = o === 'easiest' ? 'Least energy: it goes around sand and steep ground.' : 'Least distance through the same stops, whatever the ground.'
      const on = stops.filter((s) => s.included), out = on.filter((s) => s.dropped)
      if (!picked) stopNote.textContent = `${on.length - out.length} of ${stops.length} stops fit in one walk.` + (out.length ? ` Too far for the reserve: ${out.map((s) => s.name).join(', ')}.` : '')
      send.disabled = !route.stops.length || app.scout.left() <= 0
    }
    let picked = null
    function pick(id) {
      const s = app.stops().find((x) => x.id === id)
      picked = id
      stopCard.querySelector('h3').textContent = s.name
      stopNote.textContent = s.why ?? ''
      stopCard.querySelector('img')?.remove()
      if (s.photo?.image_url) { const im = Object.assign(new Image(), { src: s.photo.image_url, alt: s.photo.caption ?? s.name }); im.style.cssText = 'width:100%;border-radius:8px;margin-top:8px;display:block'; stopCard.append(im) }
    }
    map.onTap((cell) => app.addStop(cell))
    const off = app.on('plan', draw)
    draw()
    return off
  },
}
