// Stops in the field (block E6). Flag science_stop: at each planned stop the walk pauses for a short
// science checklist, modelled on how Perseverance works a target (docs/PLAN.md §2): look, get close,
// decide, then sample or move on. A sample saves a context card (cell, what every layer says there,
// the photo, the time) to the walk log. With either E6 flag: waypoint markers, warnings, the walk log.
import { Group } from 'three'
import * as log from './log.js'
import { reserveJ } from './walk.js'

export const CHECKLIST = [
  ['Look', 'Photograph the site from where you stand.'],
  ['Get close', 'Walk up to the rock and inspect it.'],
  ['Decide', 'Worth a sample? Compare it with what the map layers said.'],
]

// Route index → stop number, for stops met in order along the planned route (cells include each stop cell).
export function stopIndices(cells, stopCells) {
  const at = new Map()
  let from = 1 // index 0 is base
  stopCells.forEach((c, n) => {
    const k = cells.findIndex((p, i) => i >= from && p[0] === c[0] && p[1] === c[1])
    if (k >= 0) at.set(k, n), (from = k + 1)
  })
  return at
}

// Rover photos of a stop (stops.json), by target id or by cell.
export const photosOf = (photos, stop) =>
  photos.filter((p) => p.target_id === stop.id || (p.cell && p.cell[0] === stop.cell[0] && p.cell[1] === stop.cell[1]))

// What a sample records: where, what the map layers say there, the photo, the walk time.
export function contextCard({ meta, layers }, stop, photo, time) {
  const i = stop.cell[1] * meta.width + stop.cell[0]
  const at = Object.fromEntries(Object.entries(layers).map(([n, a]) => [n, +a[i].toPrecision(4)]))
  return { stop: stop.id, name: stop.name, goal: stop.goal ?? null, layers: at, photo: photo?.image_url ?? null, time }
}

// Warnings for the walk panel, most urgent first.
export function warnings(meta, state, margin, atStop) {
  const out = []
  if (state.energy_left_j < reserveJ(meta)) out.push('Oxygen below the reserve: head home now.')
  else if (margin < 0) out.push('Past the point of no return: head home now.')
  else if (margin < 0.1 * meta.energy_budget_j) out.push(`Turn back soon: ${Math.round(margin / 1000)} kJ to spare after the way home.`)
  if (atStop) out.push('At a stop: finish or skip the checklist to walk on.')
  return out
}

// DOM side. Returns hooks main.js calls; null-safe there with `field?.`.
export function initStops({ world, checklist, flags, photos, scene, pin, cellPos, span, getWalk, panel, map }) {
  const { meta } = world
  const store = localStorage
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props)
  const warn = el('p', { className: 'warn' })
  const card = el('div', { hidden: true })
  card.setAttribute('aria-live', 'polite')
  const markBtn = el('button', { textContent: 'Mark here' })
  const saveBtn = el('button', { textContent: 'Download walk log' })
  const note = el('small', { className: 'src', textContent: 'Tap the minimap to drop a marker there.' })
  const tools = el('div', { className: 'row' })
  tools.append(markBtn, saveBtn)
  panel.append(warn, card, el('h2', { textContent: 'Field notes' }), tools, note)
  const group = new Group() // marker pins
  scene.add(group)

  let at = new Map() // route index → stop
  let stops = []
  let open = null // the stop whose checklist is showing
  let markers = []
  let lastT = -1

  const now = () => getWalk().t
  const write = (cell, kind, value) => log.append(store, log.entry(cell, kind, value, now()))

  function dropMarker(cell) {
    const id = `M${markers.length + 1}`
    markers.push({ id, cell })
    const p = pin(0xff3bd4)
    p.rotation.x = Math.PI
    p.position.copy(cellPos(cell, span / 80))
    group.add(p)
    write(cell, 'marker', { id })
  }
  markBtn.onclick = () => dropMarker([...getWalk().cell])
  map.addEventListener('click', (e) => {
    if (panel.hidden) return // plan tab: main.js adds stops instead
    dropMarker([Math.floor((e.offsetX / map.clientWidth) * meta.width), Math.floor((e.offsetY / map.clientHeight) * meta.height)])
  })
  saveBtn.onclick = () => log.download(store, meta.name)

  function showCard(stop) {
    open = stop
    const photo = flags.has('pov_images') ? photosOf(photos, stop)[0] : null
    card.hidden = false
    card.replaceChildren(
      el('h2', { textContent: 'Science stop' }),
      el('strong', { textContent: `${stop.name}${stop.goal ? ` · ${stop.goal}` : ''}` }),
      el('p', { className: 'src', textContent: stop.why ?? '' }),
      el('p', { className: 'src', textContent: (stop.sources ?? []).join(' · ') }),
    )
    if (photo) {
      const fig = el('figure', { style: 'margin:6px 0 0' })
      fig.append(el('img', { src: photo.image_url, alt: photo.caption ?? stop.name, style: 'width:100%;border-radius:4px' }),
        el('figcaption', { textContent: [photo.caption, photo.credit, photo.sol != null && `Sol ${photo.sol}`].filter(Boolean).join(' · ') }))
      card.append(fig)
    } else if (flags.has('pov_images')) card.append(el('p', { className: 'src', textContent: 'No rover photo of this stop yet.' }))
    const list = el('ol', { style: 'margin:4px 0;padding-left:1.2em' })
    const row = el('div', { className: 'row' })
    card.append(list, row)
    let n = 0
    const next = () => {
      list.replaceChildren(...CHECKLIST.map(([what, how], j) =>
        el('li', { textContent: `${j < n ? '✓ ' : ''}${what}: ${how}`, style: j === n ? 'font-weight:bold' : 'opacity:.7' })))
      if (n < CHECKLIST.length) {
        const done = el('button', { textContent: `${CHECKLIST[n][0]}: done` })
        done.onclick = () => {
          if (n === 0) write(stop.cell, 'photo', { stop: stop.id, image_url: photo?.image_url ?? null })
          n++
          next()
        }
        row.replaceChildren(done, close('Skip stop'))
      } else {
        const sample = el('button', { textContent: 'Take sample' })
        sample.onclick = () => (write(stop.cell, 'sample', contextCard(world, stop, photo, now())), finish())
        row.replaceChildren(sample, close('Move on'))
      }
    }
    next()
  }
  const close = (label) => Object.assign(el('button', { textContent: label }), { onclick: () => finish() })
  function finish() {
    open = null
    card.hidden = true
    warn.textContent = warn.textContent.replace(/At a stop.*$/, '')
  }

  return {
    // New plan or Reset: a new walk, a new log.
    reset(route, all) {
      const list = route.stops.map((id) => all.find((s) => s.id === id))
      stops = list
      at = checklist ? stopIndices(route.cells, list.map((s) => s.cell)) : new Map()
      finish()
      markers = []
      group.clear()
      lastT = -1
      log.clear(store)
      log.append(store, { walk: meta.name, started: new Date().toISOString(), stops: route.stops, flags: [...flags] })
    },
    blocking: () => open !== null,
    // Called after each step; true when this cell is a stop (main.js pauses the walk).
    arrive(k) {
      if (!at.has(k)) return false
      showCard(stops[at.get(k)])
      return true
    },
    paint(ctx) {
      ctx.fillStyle = '#ff3bd4'
      for (const { cell: [x, y] } of markers) ctx.fillRect(x - 1, y - 1, 3, 3)
    },
    // Each render: log the app state once per tick, refresh warnings.
    onRender(state, margin) {
      if (state.t !== lastT) log.append(store, state), (lastT = state.t)
      warn.textContent = warnings(meta, state, margin, open !== null).join(' ')
    },
  }
}
