import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadWorld, layerRGB } from './world.js'
import { startWalk, stepTo, ringMask, ringLimit, appState, oxygenL } from './walk.js'

const $ = (id) => document.getElementById(id)
const worldName = new URLSearchParams(location.search).get('world') ?? 'synthetic'
const base = `${import.meta.env.BASE_URL}${worldName}`

let world, route
try {
  world = await loadWorld(base)
  route = (await fetch(`${base}/route.json`).then((r) => r.json())).cells
} catch (e) {
  $('title').textContent = `Could not load world "${worldName}": ${e.message}`
  throw e
}
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
const classRGB = layerRGB('terrain_class', layers.terrain_class)
const colors = new THREE.BufferAttribute(classRGB.slice(), 3, true)
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
const baseMarker = new THREE.Mesh(new THREE.ConeGeometry(span / 120, span / 40, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }))
baseMarker.position.copy(cellPos(meta.base_cell, span / 80))
scene.add(baseMarker)
const walker = new THREE.Mesh(new THREE.CapsuleGeometry(span / 200, span / 60, 4, 12), new THREE.MeshBasicMaterial({ color: 0x35e0ff }))
scene.add(walker)
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.map((c) => cellPos(c, 1))),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })))

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

// --- Minimap: flat, north up, one pixel per cell; outside the walk-back ring is shaded dark. ---
const map = $('map')
map.width = W
map.height = H
const ctx = map.getContext('2d')
const select = $('layer')
select.append(...Object.keys(layers).map((name) => new Option(name.replaceAll('_', ' '), name)))
select.value = 'terrain_class'
let layerColors = classRGB
select.addEventListener('change', () => {
  layerColors = layerRGB(select.value, layers[select.value])
  render()
})

function paintMinimap(inside) {
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < W * H; i++) {
    const f = inside[i] ? 1 : 0.35
    img.data.set([layerColors[i * 3] * f, layerColors[i * 3 + 1] * f, layerColors[i * 3 + 2] * f, 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = '#ffffff80'
  for (const [x, y] of route) ctx.fillRect(x, y, 1, 1)
  ctx.fillStyle = '#fff'
  ctx.fillRect(meta.base_cell[0] - 1, meta.base_cell[1] - 1, 3, 3)
  ctx.fillStyle = '#35e0ff'
  ctx.fillRect(walk.cell[0] - 1, walk.cell[1] - 1, 3, 3)
}

// --- Walk (block E2): along route.json, energy and oxygen drain, ring, point of no return. ---
let walk, k, timer
function reset() {
  pause()
  walk = startWalk(meta)
  k = 0
  document.body.classList.remove('danger')
  render()
}

function step() {
  if (k >= route.length - 1 || walk.energy_left_j <= 0) return pause()
  if (stepTo(world, walk, route[++k])) buzz()
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
    for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = classRGB[i * 3 + c] * f
  }
  colors.needsUpdate = true
  walker.position.copy(cellPos(walk.cell, span / 100))
  paintMinimap(inside)

  const s = appState(world, walk)
  window.appState = s // contract §3: what CAPCOM and the walk log read
  const kj = (j) => `${Math.round(Math.max(j, 0) / 1000)} kJ`
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
reset()
