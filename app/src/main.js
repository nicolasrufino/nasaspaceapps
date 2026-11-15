import { parseWalkNotes, showWalkNotes } from './walk-notes.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadWorld, layerRGB, sourceLabel } from './world.js'
import { startWalk, stepTo, ringMask, ringLimit, appState, oxygenL } from './walk.js'
import { planTour, MAX_STOPS } from './plan.js'
import { routeFlights, scanAt, pointAlong } from './scout.js'
import { bestAreas } from './best-areas.js'
import { beliefMap } from './belief.js'
import { terrainMaterial, setImageryUVs, loadImagery, imageryCells } from './terrain.js'
import { stretches, describe, lowestMargin, shortestAlternative } from './why.js'
import { initStops } from './stops.js'
import { initSteps } from './steps.js'
import { initTerrainClassifier } from './terrain-classifier.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
// The bare link is the judges' link: the Gale demo with the demo features on.
// ?world=synthetic loads the test world; ?flags= (empty) switches every feature off (docs/PLAN.md §10).
const DEMO_FLAGS = 'drone_scout,why_route,layers_extra,pov_images,science_stop,step_mode'
const worldName = params.get('world') ?? 'gale'
const flags = new Set((params.get('flags') ?? DEMO_FLAGS).split(',').filter(Boolean))
if (flags.has('classifier')) initTerrainClassifier($('walk'))
const base = `${import.meta.env.BASE_URL}${worldName}`
const optionalJSON = (file, fallback) => fetch(`${base}/${file}`).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback)

let world
try {
  world = await loadWorld(base)
} catch (e) {
  $('title').textContent = `Could not load world "${worldName}": ${e.message}`
  throw e
}
const targets = await optionalJSON('targets.json', [])
const photos = await optionalJSON('stops.json', []) // rover photos per stop (contract: stops.json)
const scoutPlan = await optionalJSON('scout_plan.json', []) // pipeline's extra helicopter flights (D4), when it exists
let flight = null // helicopter in the air: { flights, k, along, speed, found, before }
const { meta, layers } = world
// Energy scenario (world.json "scenarios", made by the pipeline from NASA suit figures): ?scenario=ideal or worst.
// Without the parameter the world's default applies; worlds without scenarios keep their single budget.
const scenarioId = params.get('scenario') ?? meta.default_scenario
const scenario = meta.scenarios?.[scenarioId]
if (scenario) Object.assign(meta, { energy_budget_j: scenario.energy_budget_j, reserve_fraction: scenario.reserve_fraction })
const { width: W, height: H, cell_size_m: cs } = meta
const walkNotesUrl = `${base}/walk.jsonl`
const walkNotes = flags.has('map_grows')
  ? await fetch(walkNotesUrl).then(async (response) =>
    response.ok ? parseWalkNotes(await response.text(), W, H) : []).catch(() => [])
  : []
showWalkNotes($('layers'), walkNotes, walkNotesUrl)
// The way home the ring and walk read. Live: cells the helicopter scouts switch to cost_to_go_scouted (E4).
const ctg = layers.cost_to_go
const scanned = new Uint8Array(W * H) // cells the helicopter has seen
const rockSeen = (i) => scanned[i] && layers.rocks_fine?.[i]
const cellPos = ([x, y], lift = 0) => new THREE.Vector3(x * cs, layers.height[y * W + x] + lift, y * cs)
$('title').textContent = `${meta.name} · ${W}×${H} cells · ${cs} m${scenario ? ` · ${scenario.name}` : ''}`

// --- 3D view: visual only, no route maths here (docs/CRITIQUE.md). ---
// One vertex per cell; cell (x, y) sits at (x*cs, height, y*cs), so +z is south and north is -z.
const geo = new THREE.PlaneGeometry((W - 1) * cs, (H - 1) * cs, W - 1, H - 1)
geo.rotateX(-Math.PI / 2) // PlaneGeometry's first vertex row becomes the north edge, matching row 0
geo.translate(((W - 1) * cs) / 2, 0, ((H - 1) * cs) / 2)
const pos = geo.attributes.position
for (let i = 0; i < W * H; i++) pos.setY(i, layers.height[i])
geo.computeVertexNormals()
const colors = new THREE.BufferAttribute(new Uint8Array(W * H * 3), 3, true)
geo.setAttribute('color', colors)
setImageryUVs(geo, meta)
const terrainMat = terrainMaterial()
const terrain = new THREE.Mesh(geo, terrainMat)

const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xc9a27e) // dusty Mars sky
scene.add(terrain)
scene.add(new THREE.HemisphereLight(0xffe8d0, 0x402015, 1.2))
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(-1, 0.6, -0.4) // low sun so slopes read
scene.add(sun)

const span = Math.max(W, H) * cs
const pin = (color) => new THREE.Mesh(new THREE.ConeGeometry(span / 120, span / 40, 12), new THREE.MeshBasicMaterial({ color }))
const baseMarker = pin(0xffffff)
baseMarker.position.copy(cellPos(meta.base_cell, span / 80))
scene.add(baseMarker)
const pins = new THREE.Group() // science stops, rebuilt when the plan changes
scene.add(pins)
const walker = new THREE.Mesh(new THREE.CapsuleGeometry(span / 200, span / 60, 4, 12), new THREE.MeshBasicMaterial({ color: 0x35e0ff }))
scene.add(walker)
const altLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xd0d0d0, dashSize: span / 120, gapSize: span / 120 }))
altLine.visible = false // E5: the shortest-distance route the planner rejected
scene.add(altLine)
const beforeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xff3b30, dashSize: span / 100, gapSize: span / 150 }))
beforeLine.visible = false // the route before the scout flight, for the before/after
scene.add(beforeLine)
const routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }))
scene.add(routeLine)

const camera = new THREE.PerspectiveCamera(50, 1, span / 1000, span * 10)
const center = new THREE.Vector3(((W - 1) * cs) / 2, 0, ((H - 1) * cs) / 2)
camera.position.set(center.x, span * 0.6, center.z + span * 0.8)
const controls = new OrbitControls(camera, $('scene'))
controls.target.copy(center)
controls.enableDamping = true

function resize() {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()
let lastFrame = performance.now()
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - lastFrame) / 1000, 0.1)
  lastFrame = now
  if (flight) tickFlight(dt)
  controls.update()
  renderer.render(scene, camera)
})

// --- Plan mode (block E3): layer toggles with their source, targets, route, stop previews. ---
// rocks_fine and cost_to_go_scouted stay hidden until the drone has flown (E4).
const EXTRA = ['thermal_inertia', 'science', 'dose_rate'] // THEMIS, CRISM, Curiosity RAD: flag layers_extra
const shownLayers = meta.layers.filter((n) => layers[n] && n !== 'rocks_fine' && (!EXTRA.includes(n) || flags.has('layers_extra')))
const IMAGERY = 'imagery' // HiRISE colour draped on the terrain (ticket F2); the default view when the world has it
const WHITE = new Uint8Array(W * H * 3).fill(255)
let imageryRGB = null // one colour per cell, for the minimap
let layerName = 'terrain_class'
let layerColors = layerRGB(layerName, layers[layerName])
// Colours for a layer; "best areas" is computed from what is known now (best-areas.js), not read from a file.
const colorsFor = (name) => name === IMAGERY ? (imageryRGB ?? WHITE) : layerRGB(name, name === 'best_areas' ? bestAreas(world, ctg, scanned, blocked)
  : name === 'belief' ? beliefMap(world, scanned, blocked) : layers[name])
function refreshLayer() {
  if (layerName === 'best_areas' || layerName === 'belief') layerColors = colorsFor(layerName)
}
function setLayer(name) {
  layerName = name
  layerColors = colorsFor(name)
  terrainMat.userData.uniforms.uOverlay.value = name === IMAGERY ? 0 : 1
  document.querySelectorAll('#layers input').forEach((el) => (el.checked = el.value === name))
}
$('sources').textContent = meta.sources?.all ?? '' // applies to every layer without its own source
const BEST = 'best_areas'
const BELIEF = flags.has('belief') ? ['belief'] : [] // chance of hidden rocks (belief map v1, flag belief)
const layerSource = (name) => name === BEST
  ? 'Computed: round trip from base fits the usable energy, slope within the limit, no rocks seen; unscouted ground counts half'
  : name === 'belief'
    ? 'Predicted chance of hidden rocks from 8 m slope and relief (HiRISE terrain); scouted cells show what was found. Estimate'
    : name === IMAGERY
      ? 'MRO · HiRISE colour (USGS MSL Gale LRGB 25 cm mosaic) · NASA/JPL-Caltech/University of Arizona'
      : sourceLabel(meta, name)
$('layers').append(...[...(meta.detail_tiles?.url ? [IMAGERY] : []), ...shownLayers, BEST, ...BELIEF].map((name) => {
  const label = document.createElement('label')
  label.innerHTML = `<input type="radio" name="layer"><span><b></b><small></small></span>`
  label.querySelector('input').checked = name === layerName
  label.querySelector('input').value = name
  label.querySelector('b').textContent = name.replaceAll('_', ' ')
  label.querySelector('small').textContent = layerSource(name)
  label.querySelector('input').onchange = () => {
    setLayer(name)
    render()
  }
  return label
}))

const kj = (j) => `${Math.round(Math.max(j, 0) / 1000)} kJ`

// --- Science stops and the planned route. Targets come from targets.json (picked from the data);
// the crew can add their own by tapping the minimap. The planner picks the order and the path. ---
const custom = [] // stops the crew added
const included = new Set(targets.map((t) => t.id))
let selected = null
let route // { cells, stops, dropped, energy_j, minutes }
let blocked = null // rocks the scout has found (E4); the planner routes around them
const allStops = () => [...targets, ...custom]

let scoutBefore = null // { cells, energy_j, crossed }: the route before the last scout, for E5
function replan(keepBefore = false) {
  beforeLine.visible = keepBefore
  if (!keepBefore) scoutBefore = null
  if (!keepBefore) $('scoutStatus').textContent = ''
  route = planTour(world, allStops().filter((s) => included.has(s.id)), blocked)
  refreshLayer()
  routeLine.geometry.dispose()
  routeLine.geometry = new THREE.BufferGeometry().setFromPoints(route.cells.map((c) => cellPos(c, 1)))
  if (flags.has('why_route')) explain()
  reset() // a new plan starts a new walk; reset also draws the stops
}

// --- Why this route (block E5, flag why_route): numbers for each stretch, the tightest moment,
// and the alternatives the planner beat. Measures; decides nothing. ---
function explain() {
  $('whyBox').hidden = !route.stops.length
  altLine.visible = false
  if (!route.stops.length) return
  const name = (id) => allStops().find((s) => s.id === id)?.name ?? id
  const ends = ['Base', ...route.stops.map(name), 'Base']
  const stopCells = route.stops.map((id) => allStops().find((s) => s.id === id).cell)
  const parts = stretches(route, stopCells)
  const pct = (v) => `${Math.round(v * 100)}%`
  const rows = parts.map((p, k) => {
    const d = describe(world, p)
    return `<tr><td>${esc(ends[k])} → ${esc(ends[k + 1])}</td><td>${Math.round(d.metres)}</td><td>${Math.round(d.energy_j / 1000)}</td>` +
      `<td>${d.minutes.toFixed(1)}</td><td>${d.steepest_deg.toFixed(0)}°</td><td>${pct(d.sand_share)}</td></tr>`
  })
  $('whyTable').innerHTML = `<tr><th>Stretch</th><th>m</th><th>kJ</th><th>min</th><th>Steepest</th><th>Sand</th></tr>${rows.join('')}`

  const all = describe(world, route.cells, blocked)
  const notes = []
  const steepK = parts.findIndex((p) => describe(world, p).steepest_deg === all.steepest_deg)
  notes.push(`Steepest ground: ${all.steepest_deg.toFixed(0)}° on ${ends[steepK]} → ${ends[steepK + 1]} (the limit is ${meta.knobs.max_slope_deg}°).`)
  const low = lowestMargin(world, route.cells, ctg)
  let at = 0
  for (let n = 0, k = 0; k < parts.length; k++) if (low.index <= (n += parts[k].length - 1)) { at = k; break }
  notes.push(`Tightest moment: ${kj(low.margin_j)} to spare after the way home and the ${kj(meta.reserve_fraction * meta.energy_budget_j)} reserve, on ${ends[at]} → ${ends[at + 1]}.`)

  const altCells = shortestAlternative(world, stopCells, blocked)
  const alt = describe(world, altCells)
  const extra = alt.energy_j - all.energy_j
  if (extra < all.energy_j * 0.01) notes.push('The shortest route through these stops is also the easiest here.')
  else {
    const why = []
    if (alt.sand_share > all.sand_share + 0.02) why.push(`${pct(alt.sand_share)} of it is sand (ours ${pct(all.sand_share)})`)
    if (alt.climb_m > all.climb_m + 1) why.push(`it climbs ${Math.round(alt.climb_m)} m (ours ${Math.round(all.climb_m)} m)`)
    if (alt.steepest_deg > all.steepest_deg + 0.5) why.push(`it gets as steep as ${alt.steepest_deg.toFixed(0)}°`)
    notes.push(`Rejected (grey dashes): the shortest route through the same stops is ${Math.round(all.metres - alt.metres)} m shorter ` +
      `but costs ${kj(alt.energy_j)} (+${Math.round((extra / all.energy_j) * 100)}%)${why.length ? `: ${why.join(', ')}` : ''}.`)
    altLine.geometry.dispose()
    altLine.geometry = new THREE.BufferGeometry().setFromPoints(altCells.map((c) => cellPos(c, 0.6)))
    altLine.computeLineDistances()
    altLine.visible = true
  }
  if (scoutBefore?.crossed) notes.push(`Before scouting (red dashes), the route crossed ${scoutBefore.crossed} rock cells the helicopter found; avoiding them costs ${kj(all.energy_j - scoutBefore.energy_j)} more.`)
  $('whyNotes').replaceChildren(...notes.map((t) => Object.assign(document.createElement('li'), { textContent: t })))
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function drawStops() {
  pins.clear()
  for (const s of allStops()) {
    const on = included.has(s.id)
    const p = pin(!on ? 0x8a8a8a : route.dropped.includes(s.id) ? 0xff5a3d : s.custom ? 0xff9f1c : 0xffd23f)
    p.rotation.x = Math.PI // pointing down at the spot
    p.position.copy(cellPos(s.cell, span / 80))
    p.scale.setScalar(s.id === selected ? 1.8 : 1)
    pins.add(p)
  }
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const name = (id) => allStops().find((s) => s.id === id)?.name ?? id
  $('route').textContent = route.stops.length
    ? `Planned: base → ${route.stops.map(name).join(' → ')} → base · ${kj(route.energy_j)} of ${kj(usable)} usable · ${Math.round(route.minutes)} min walking`
    : included.size ? 'None of the chosen stops fits in one walk with the reserve kept.' : 'No stops chosen yet.'
  const over = route.dropped.length ? `Doesn't fit in one walk: ${route.dropped.map(name).join(', ')}` : ''
  const many = included.size > MAX_STOPS ? ` Only the first ${MAX_STOPS} stops are planned.` : ''
  $('dropped').textContent = over + many
  listStops()
}

function listStops() {
  $('targets').replaceChildren(...allStops().map((s) => {
    const row = document.createElement('div')
    row.className = 'stop'
    row.innerHTML = '<input type="checkbox"><button class="name"></button>'
    const box = row.querySelector('input')
    box.checked = included.has(s.id)
    box.setAttribute('aria-label', `Include ${s.name} in the walk`)
    box.onchange = () => (box.checked ? included.add(s.id) : included.delete(s.id), replan())
    const b = row.querySelector('button')
    b.textContent = s.name
    b.setAttribute('aria-pressed', s.id === selected)
    b.onclick = () => select(s.id)
    if (s.custom) {
      const x = Object.assign(document.createElement('button'), { textContent: '×', ariaLabel: `Remove ${s.name}` })
      x.onclick = () => removeCustom(s.id)
      row.append(x)
    }
    return row
  }))
}

function removeCustom(id) {
  custom.splice(custom.findIndex((s) => s.id === id), 1)
  included.delete(id)
  if (selected === id) (selected = null), $('detail').replaceChildren()
  replan()
}

let customCount = 0
// Tap the minimap (plan tab): on your own stop removes it, on a target toggles it, elsewhere adds a stop.
$('map').addEventListener('click', (e) => {
  if ($('plan').hidden) return
  const cell = [Math.floor((e.offsetX / $('map').clientWidth) * W), Math.floor((e.offsetY / $('map').clientHeight) * H)]
  const near = allStops().find((s) => Math.hypot(s.cell[0] - cell[0], s.cell[1] - cell[1]) <= 2)
  if (near?.custom) return removeCustom(near.id)
  if (near) {
    if (included.has(near.id)) included.delete(near.id)
    else included.add(near.id)
    return replan()
  }
  const id = `C${++customCount}`
  custom.push({ id, name: `Your stop ${customCount}`, cell, custom: true, why: 'Picked on the map.' })
  included.add(id)
  replan()
})

function select(id) {
  selected = id
  const t = allStops().find((s) => s.id === id)
  // Swing the view to the stop, keeping the camera's offset.
  const to = cellPos(t.cell)
  camera.position.add(to.clone().sub(controls.target))
  controls.target.copy(to)

  const d = $('detail')
  d.innerHTML = `<strong></strong><p class="why"></p><p class="src"></p>`
  d.querySelector('strong').textContent = `${t.name}${t.goal ? ` · ${t.goal}` : ''}`
  d.querySelector('.why').textContent = t.why ?? ''
  d.querySelector('.src').textContent = (t.sources ?? []).join(' · ')
  if (flags.has('pov_images') && !t.custom) {
    const mine = photos.filter((s) => s.target_id === t.id || (s.cell && s.cell[0] === t.cell[0] && s.cell[1] === t.cell[1]))
    if (!mine.length) d.append(Object.assign(document.createElement('p'), { textContent: 'No rover photo of this stop yet.' }))
    for (const s of mine) {
      const fig = document.createElement('figure')
      fig.innerHTML = `<img loading="lazy"><figcaption></figcaption>`
      Object.assign(fig.querySelector('img'), { src: s.image_url, alt: s.caption ?? t.name })
      fig.querySelector('figcaption').textContent = [s.caption, s.credit, s.sol != null && `Sol ${s.sol}`].filter(Boolean).join(' · ')
      d.append(fig)
    }
  }
  drawStops()
  render()
}

for (const b of document.querySelectorAll('[data-tab]')) {
  b.onclick = () => {
    for (const o of document.querySelectorAll('[data-tab]')) o.setAttribute('aria-selected', o === b)
    $('plan').hidden = b.dataset.tab !== 'plan'
    $('walk').hidden = b.dataset.tab !== 'walk'
  }
}

// --- Minimap: flat, north up, one pixel per cell; outside the walk-back ring is shaded dark. ---
const map = $('map')
map.width = W
map.height = H
const ctx = map.getContext('2d')

function paintMinimap(inside) {
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < W * H; i++) {
    const f = inside[i] ? 1 : 0.35
    if (rockSeen(i)) img.data.set([230, 40, 40, 255], i * 4)
    else img.data.set([layerColors[i * 3] * f, layerColors[i * 3 + 1] * f, layerColors[i * 3 + 2] * f, 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = '#ffffffb0'
  for (const [x, y] of route.cells) ctx.fillRect(x, y, 1, 1)
  for (const s of allStops()) {
    const r = s.id === selected ? 2 : 1
    ctx.fillStyle = !included.has(s.id) ? '#8a8a8a' : route.dropped.includes(s.id) ? '#ff5a3d' : s.custom ? '#ff9f1c' : '#ffd23f'
    ctx.fillRect(s.cell[0] - r, s.cell[1] - r, 2 * r + 1, 2 * r + 1)
  }
  ctx.fillStyle = '#f488ee'
  for (const { cell: [x, y] } of walkNotes) ctx.fillRect(x - 1, y - 1, 3, 3)
  ctx.fillStyle = '#fff'
  ctx.fillRect(meta.base_cell[0] - 1, meta.base_cell[1] - 1, 3, 3)
  ctx.fillStyle = '#35e0ff'
  ctx.fillRect(walk.cell[0] - 1, walk.cell[1] - 1, 3, 3)
  field?.paint(ctx)
}

// --- Helicopter scout (block E4, flag drone_scout): flies the planned route, reveals rocks, re-plans. ---
const heliSize = span / 150
const ALT = span / 25 // flying height above the ground, for the view only
function makeHeli() {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.SphereGeometry(heliSize, 16, 12), new THREE.MeshStandardMaterial({ color: 0xeeeeee })))
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(heliSize * 6, heliSize / 6, heliSize / 2), new THREE.MeshBasicMaterial({ color: 0x222222 }))
  rotor.position.y = heliSize * 1.3
  g.add(rotor)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(15, ALT, 24, 1, true), // 15 m = SWATH_M
    new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }))
  beam.position.y = -ALT / 2
  g.add(beam)
  g.visible = false
  g.userData.rotor = rotor
  scene.add(g)
  return g
}
const heli = makeHeli()
const rotor = heli.userData.rotor
function placeHeli(h, [x, y]) {
  h.position.set(x * cs, layers.height[Math.round(y) * W + Math.round(x)] + ALT, y * cs)
}
const dotPos = new Float32Array(W * H * 3)
const dotCol = new Float32Array(W * H * 3)
const dotsGeo = new THREE.BufferGeometry()
dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3))
dotsGeo.setAttribute('color', new THREE.BufferAttribute(dotCol, 3))
dotsGeo.setDrawRange(0, 0)
const scanDots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ size: span / 300, vertexColors: true }))
scanDots.visible = false // shown while helicopters fly; after landing the terrain itself shows the rocks
scene.add(scanDots)
let dots = 0

// Cells seen for the first time: switch their way home to the scouted one, add scan dots. Returns rocks found.
function reveal(fresh) {
  let rocks = 0
  for (const i of fresh) {
    const rock = layers.rocks_fine[i]
    rocks += rock
    if (layers.cost_to_go_scouted) ctg[i] = layers.cost_to_go_scouted[i]
    dotPos.set([(i % W) * cs, layers.height[i] + 0.5, Math.floor(i / W) * cs], dots * 3)
    dotCol.set(rock ? [1, 0.2, 0.15] : [0.55, 0.95, 1], dots * 3)
    dots++
  }
  if (fresh.length) {
    dotsGeo.attributes.position.needsUpdate = dotsGeo.attributes.color.needsUpdate = true
    dotsGeo.setDrawRange(0, dots)
  }
  return rocks
}

if (flags.has('drone_scout') && layers.rocks_fine) $('scoutBox').hidden = false
$('scout').onclick = () => {
  if (flight) return
  const flights = [...routeFlights(meta, route.cells).map((f) => ({ ...f, kind: 'route corridor' })),
    ...scoutPlan.map((f) => ({ waypoints: f.waypoints, metres: f.metres, kind: f.kind === 'uncertain' ? 'least certain' : f.kind ?? 'extra' }))]
  if (!flights.length) return
  const metres = flights.reduce((m, f) => m + f.metres, 0)
  flight = { flights, k: 0, along: 0, speed: metres / 9, found: 0, before: route } // the whole scout plays in ~9 s
  pause()
  $('scout').disabled = true
  heli.visible = scanDots.visible = true
}

function tickFlight(dt) {
  rotor.rotation.y += dt * 40
  const f = flight.flights[flight.k]
  flight.along += flight.speed * dt
  const p = pointAlong(meta, f.waypoints, flight.along)
  if (!p) {
    flight.k++
    flight.along = 0
    if (flight.k >= flight.flights.length) land()
    return
  }
  placeHeli(heli, p)
  const fresh = scanAt(meta, scanned, p[0], p[1])
  flight.found += reveal(fresh)
  if (fresh.length) render()
  $('scoutStatus').textContent = `Flight ${flight.k + 1} of ${flight.flights.length} (${f.kind}) · ${flight.found} rock cells found · ` +
    `simulated helicopter flight, rocks from ${sourceLabel(meta, 'rocks_fine') || meta.sources?.all || 'rocks_fine'}`
}

function land() {
  const { before, found } = flight
  flight = null
  heli.visible = scanDots.visible = false
  $('scout').disabled = false
  $('scout').textContent = 'Fly the new route'
  blocked = Uint8Array.from(scanned, (v, i) => v && layers.rocks_fine[i])
  const crossed = before.cells.filter(([x, y]) => blocked[y * W + x]).length
  scoutBefore = { cells: before.cells, energy_j: before.energy_j, crossed }
  beforeLine.geometry.dispose()
  beforeLine.geometry = new THREE.BufferGeometry().setFromPoints(before.cells.map((c) => cellPos(c, 1.5)))
  beforeLine.computeLineDistances()
  replan(crossed > 0)
  $('scoutStatus').textContent = !crossed
    ? `Scouted: ${found} rock cells found, none on the route. The route stands.`
    : `Scouted: ${found} rock cells found; the old route (red dashes) crossed ${crossed}. ` +
      `New route avoids them: ${kj(before.energy_j)} → ${kj(route.energy_j)}` +
      (route.dropped.length > before.dropped.length
        ? `; now doesn't fit: ${route.dropped.filter((d) => !before.dropped.includes(d)).map((d) => allStops().find((s) => s.id === d)?.name ?? d).join(', ')}`
        : '')
}

// --- Walk (block E2): along the planned route, energy and oxygen drain, ring, point of no return. ---
let walk, k, timer
// Block E6 (flags science_stop, step_mode): stop checklist, markers, warnings, walk log; real steps. Off: null.
const field = flags.has('science_stop') || flags.has('step_mode')
  ? initStops({ world, checklist: flags.has('science_stop'), flags, photos, scene, pin, cellPos, span, getWalk: () => walk, panel: $('walk'), map })
  : null
const steps = flags.has('step_mode')
  ? initSteps({ panel: $('walk'), cs, segment: () => (k < route.cells.length - 1 ? [route.cells[k], route.cells[k + 1]] : null), blocked: () => !!field?.blocking(), step })
  : null
function reset() {
  pause()
  walk = startWalk(meta)
  k = 0
  field?.reset(route, allStops())
  document.body.classList.remove('danger')
  drawStops()
  render()
}

function step() {
  if (k >= route.cells.length - 1 || walk.energy_left_j <= 0 || field?.blocking()) return pause()
  if (stepTo(world, walk, route.cells[++k])) buzz()
  if (field?.arrive(k)) pause()
  render()
}

function play() {
  unlockAudio()
  timer ??= setInterval(step, 120) // ponytail: fixed playback speed; a speed knob when the demo asks for one
  $('play').textContent = 'Pause'
}
function pause() {
  clearInterval(timer)
  timer = undefined
  $('play').textContent = 'Walk'
}

function render() {
  const inside = ringMask(ctg, ringLimit(meta, walk))
  const vertexBase = layerName === IMAGERY ? WHITE : layerColors // the image itself carries the colour in the Imagery view
  for (let i = 0; i < W * H; i++) {
    const f = inside[i] ? 1 : 0.45
    if (rockSeen(i)) colors.array.set([200, 35, 35], i * 3)
    else for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = vertexBase[i * 3 + c] * f
  }
  colors.needsUpdate = true
  walker.position.copy(cellPos(walk.cell, span / 100))
  paintMinimap(inside)

  const s = appState(world, walk)
  if (steps?.live) s.mode = 'step'
  window.appState = s // contract §3: what CAPCOM and the walk log read
  const margin = ringLimit(meta, walk) - s.cost_to_go_j
  field?.onRender(s, margin)
  $('energy').value = Math.max(walk.energy_left_j, 0) / meta.energy_budget_j
  $('stats').textContent = [
    `Energy ${kj(walk.energy_left_j)} of ${kj(meta.energy_budget_j)}`,
    `Oxygen ${oxygenL(meta, walk.energy_left_j).toFixed(1)} L`,
    `Time ${Math.floor(Math.round(walk.t) / 60)}:${String(Math.round(walk.t) % 60).padStart(2, '0')}`,
    `Cost home ${kj(s.cost_to_go_j)} · reserve ${kj(s.reserve_j)}`,
    margin >= 0 ? `Margin ${kj(margin)}` : `Past the point of no return by ${kj(-margin)}`,
  ].join('\n')
  document.body.classList.toggle('danger', !walk.inside_ring)
}

// iOS Safari has no vibration, so the buzz is also a beep (audio unlocks on the first tap).
let audio
function unlockAudio() {
  audio ??= new AudioContext()
}
function buzz() {
  navigator.vibrate?.([300, 100, 300])
  if (!audio) return
  const osc = audio.createOscillator()
  osc.frequency.value = 880
  osc.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.4)
}

$('play').onclick = () => (timer ? pause() : play())
$('step').onclick = () => (unlockAudio(), step())
$('reset').onclick = reset
replan()

// Real imagery (ticket F2): drape HiRISE on the terrain and make it the default view; it sharpens as tiles arrive.
loadImagery(meta, renderer, (canvas) => {
  imageryRGB = imageryCells(canvas, W, H)
  if (layerName === IMAGERY) { layerColors = imageryRGB; render() }
}).then((imagery) => {
  if (!imagery) return
  terrainMat.map = imagery.texture
  terrainMat.userData.uniforms.uHasMap.value = 1
  terrainMat.needsUpdate = true
  setLayer(IMAGERY)
  render()
}).catch(() => {}) // no network or no tiles: the class colours stay
