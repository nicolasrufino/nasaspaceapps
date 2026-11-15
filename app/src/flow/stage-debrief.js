// Stage 4, Choose the walk: back at the habitat. The 2D map shows the scouted route against the route planned before
// the scout, with the rock cells the old one would have crossed; then preview the walk from behind the astronaut.
// Every number here is read from `app` at run time. Picture: NASA MRO HiRISE (NASA/JPL-Caltech/University of Arizona).
const RED = '#ff5a3d'
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

export default {
  enter(ui, app) {
    app.camera('habitat')
    const { map } = ui
    const W = app.W
    let timer = null, previewing = false, show = 'both'

    // --- Cards ---
    const changed = ui.card('What the scout changed')
    const changeStats = ui.stats([['rock cells on the old route', '0', 'hazard'], ['kJ for the safe route', '0'], ['% of the walking budget', '0']])
    const changeNote = ui.h('p')
    const seg = ui.h('div', 'f-seg')
    seg.style.marginTop = '10px'
    const showBtn = {}
    for (const [key, text] of [['both', 'Both'], ['new', 'Scouted'], ['old', 'Without']]) seg.append((showBtn[key] = ui.button(text, () => { show = key; draw() })))
    for (const b of Object.values(showBtn)) b.style.cssText = 'min-height:36px;font-size:12px;padding:0 8px'
    changed.append(changeStats.el, changeNote, seg)

    const walkCard = ui.card('The walk')
    const walkStats = ui.stats([['metres', '0'], ['minutes', '0'], ['kJ of walking', '0']])
    walkCard.append(walkStats.el)

    const liveCard = ui.card('Walking the scouted route')
    const liveStats = ui.stats([['kJ left', '0', 'scout'], ['% of the way', '0']])
    const liveBar = ui.bar()
    liveCard.append(liveStats.el, liveBar.el)

    // --- Buttons ---
    const row = ui.h('div', 'f-row')
    const previewBtn = ui.button('Preview the walk', startPreview, true)
    const againBtn = ui.button('Scout again', () => ui.go('plan'))
    const stopsBtn = ui.button('Change the stops', () => ui.go('plan'))
    const visionBtn = ui.button('Explore in Vesta Vision', () => { location.href = './?vision' })
    visionBtn.style.cssText = 'background:none;border:0;backdrop-filter:none;text-decoration:underline;text-underline-offset:3px;padding:0 10px'
    const stopBtn = ui.button('Stop preview', stopPreview, true)

    // The old route as planned before the scout, and which of its cells turned out to be rock.
    const rocksOn = (cells) => (cells ?? []).filter(([x, y]) => app.rockSeen(y * W + x))

    function drawMap(mini) {
      const route = app.route(), before = app.scout.before(), stops = app.stops().map((s, n) => ({ ...s, n: n + 1 })).filter((s) => s.included && !s.dropped)
      const oldCells = before?.cells ?? []
      map.fit([app.meta.base_cell, ...route.cells, ...oldCells, ...stops.map((s) => s.cell)], 16)
      map.paintScouted()
      const k = map.scale * (mini ? 2.2 : 1) // the mini map is about a third of the size: keep marks readable
      const oldOn = !mini && show !== 'new' && oldCells.length, newOn = mini || show !== 'old'
      map.line('route', newOn ? route.cells : [], { color: '#fff', width: 2.2 * k })
      map.line('before', oldOn ? oldCells : [], { color: RED, width: 1.8 * k, dash: `${4 * k} ${3.5 * k}` })
      map.dots('crossed', oldOn ? rocksOn(oldCells).map((cell) => ({ cell, color: RED, ring: '#fff', r: 2.4 * k })) : [])
      map.dots('stops', [
        { cell: app.meta.base_cell, label: 'H', color: '#fff', r: 7 * k },
        ...stops.map((s) => ({ cell: s.cell, label: s.n, color: '#ffd23f', r: 7 * k })),
      ])
      map.raise('route'); map.raise('stops')
      return k
    }

    function draw() {
      if (previewing) return
      const route = app.route(), before = app.scout.before(), d = app.describe(route.cells)
      map.size('big')
      map.caption('After scouting', before ? 'White: scouted route · red dashes: without the scout · red dots: rock it would have crossed' : 'White: the route · NASA MRO HiRISE')
      map.clear('walker')
      drawMap(false)

      const crossed = before?.crossed ?? 0, extra = before ? Math.round((route.energy_j - before.energy_j) / 1000) : 0
      const stillOn = rocksOn(route.cells).length
      changeStats.set(0, crossed)
      changeStats.set(1, signed(extra))
      changeStats.set(2, Math.round((route.energy_j / app.usableJ) * 100))
      const cost = extra > 0 ? `costs ${extra} kJ more` : extra < 0 ? `costs ${-extra} kJ less` : 'costs the same'
      changeNote.textContent = !before ? 'No scouting yet: this is the route as seen from orbit.'
        : crossed === 0 ? `The route was already clear. The scout found no rock on it${extra ? `, and the walk now ${cost}` : ''}.`
        : `The old route crossed ${crossed} rock ${crossed === 1 ? 'cell' : 'cells'}. The new one crosses ${stillOn || 'none'} and ${cost}.`
      seg.style.display = before ? '' : 'none'
      for (const key in showBtn) showBtn[key].setAttribute('aria-pressed', show === key)

      walkStats.set(0, Math.round(d.metres)); walkStats.set(1, Math.round(route.minutes)); walkStats.set(2, ui.kj(route.energy_j))
      againBtn.style.display = app.scout.left() > 0 ? '' : 'none'
      previewBtn.disabled = route.cells.length < 2
    }

    function comparison() {
      ui.center.replaceChildren(map.el)
      ui.br.replaceChildren()
      ui.left.replaceChildren(changed)
      ui.right.replaceChildren(walkCard)
      row.replaceChildren(previewBtn, againBtn, stopsBtn, visionBtn)
      draw()
    }

    function tick(k) {
      const s = app.walk.state(), cells = app.route().cells
      const cell = cells[Math.min(s.k, cells.length - 1)]
      if (cell) map.dots('walker', [{ cell, color: '#35e0ff', ring: '#fff', r: 5 * k }])
      liveBar.set(s.of > 0 ? s.k / s.of : 0)
      liveStats.set(0, ui.kj(s.energy_left_j))
      liveStats.set(1, s.of > 0 ? Math.round((s.k / s.of) * 100) : 0)
      if (s.k >= s.of) stopPreview()
    }

    function startPreview() {
      if (previewing || app.route().cells.length < 2) return
      previewing = true
      app.camera('walker')
      app.walk.reset()
      app.walk.play()
      ui.center.replaceChildren()
      ui.right.replaceChildren()
      ui.left.replaceChildren(liveCard)
      row.replaceChildren(stopBtn)
      map.size('mini')
      map.caption('The walk', '')
      ui.br.replaceChildren(map.el)
      const k = drawMap(true)
      tick(k)
      if (previewing) timer = setInterval(() => tick(k), 250)
    }

    function stopPreview() {
      clearInterval(timer); timer = null
      if (!previewing) return
      previewing = false
      app.walk.pause()
      app.camera('habitat')
      comparison()
    }

    ui.bottom.append(row)
    comparison()
    const off = app.on('plan', draw)

    return () => {
      clearInterval(timer); timer = null
      previewing = false
      off()
      app.walk.pause()
      for (const name of ['before', 'crossed', 'walker']) map.clear(name)
    }
  },
}
