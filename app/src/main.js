import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadWorld, layerRGB, sourceLabel } from './world.js'
import { startWalk, stepTo, ringMask, ringLimit, appState, oxygenL } from './walk.js'
import { planTour, MAX_STOPS } from './plan.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
const worldName = params.get('world') ?? 'synthetic'
// Feature flags (docs/PLAN.md §10), all off by default: ?flags=layers_extra,pov_images
const flags = new Set((params.get('flags') ?? '').split(',').filter(Boolean))
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
const { meta, layers } = world
const { width: W, height: H, cell_size_m: cs } = meta
const ctg = layers.cost_to_go
const cellPos = ([x, y], lift = 0) => new THREE.Vector3(x * cs, layers.height[y * W + x] + lift, y * cs)
$('title').textContent = `${meta.name} · ${W}×${H} cells · ${cs} m`

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
const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))

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
renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})

// --- Plan mode (block E3): layer toggles with their source, targets, route, stop previews. ---
// rocks_fine and cost_to_go_scouted stay hidden until the drone has flown (E4).
const EXTRA = ['thermal_inertia', 'science', 'dose_rate'] // THEMIS, CRISM, Curiosity RAD: flag layers_extra
const shownLayers = meta.layers.filter((n) => layers[n] && n !== 'rocks_fine' && (!EXTRA.includes(n) || flags.has('layers_extra')))
let layerName = 'terrain_class'
let layerColors = layerRGB(layerName, layers[layerName])
$('sources').textContent = meta.sources?.all ?? '' // applies to every layer without its own source
$('layers').append(...shownLayers.map((name) => {
  const label = document.createElement('label')
  label.innerHTML = `<input type="radio" name="layer"><span><b></b><small></small></span>`
  label.querySelector('input').checked = name === layerName
  label.querySelector('b').textContent = name.replaceAll('_', ' ')
  label.querySelector('small').textContent = sourceLabel(meta, name)
  label.querySelector('input').onchange = () => {
    layerName = name
    layerColors = layerRGB(name, layers[name])
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

function replan() {
  route = planTour(world, allStops().filter((s) => included.has(s.id)), blocked)
  routeLine.geometry.dispose()
  routeLine.geometry = new THREE.BufferGeometry().setFromPoints(route.cells.map((c) => cellPos(c, 1)))
  reset() // a new plan starts a new walk; reset also draws the stops
}

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
    img.data.set([layerColors[i * 3] * f, layerColors[i * 3 + 1] * f, layerColors[i * 3 + 2] * f, 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = '#ffffffb0'
  for (const [x, y] of route.cells) ctx.fillRect(x, y, 1, 1)
  for (const s of allStops()) {
    const r = s.id === selected ? 2 : 1
    ctx.fillStyle = !included.has(s.id) ? '#8a8a8a' : route.dropped.includes(s.id) ? '#ff5a3d' : s.custom ? '#ff9f1c' : '#ffd23f'
    ctx.fillRect(s.cell[0] - r, s.cell[1] - r, 2 * r + 1, 2 * r + 1)
  }
  ctx.fillStyle = '#fff'
  ctx.fillRect(meta.base_cell[0] - 1, meta.base_cell[1] - 1, 3, 3)
  ctx.fillStyle = '#35e0ff'
  ctx.fillRect(walk.cell[0] - 1, walk.cell[1] - 1, 3, 3)
}

// --- Walk (block E2): along the planned route, energy and oxygen drain, ring, point of no return. ---
let walk, k, timer
function reset() {
  pause()
  walk = startWalk(meta)
  k = 0
  document.body.classList.remove('danger')
  drawStops()
  render()
}

function step() {
  if (k >= route.cells.length - 1 || walk.energy_left_j <= 0) return pause()
  if (stepTo(world, walk, route.cells[++k])) buzz()
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
  for (let i = 0; i < W * H; i++) {
    const f = inside[i] ? 1 : 0.45
    for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = layerColors[i * 3 + c] * f
  }
  colors.needsUpdate = true
  walker.position.copy(cellPos(walk.cell, span / 100))
  paintMinimap(inside)

  const s = appState(world, walk)
  window.appState = s // contract §3: what CAPCOM and the walk log read
  const margin = ringLimit(meta, walk) - s.cost_to_go_j
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
