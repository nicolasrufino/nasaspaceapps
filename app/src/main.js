import { parseWalkNotes, showWalkNotes } from './walk-notes.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadWorld, layerRGB, sourceLabel } from './world.js'
import { startWalk, stepTo, ringMask, ringLimit, appState, oxygenL } from './walk.js'
import { createPlaybackClock } from './playback.js'
import { planTour, MAX_STOPS } from './plan.js'
import { mountFlightLog } from './scout-why.js'
import { createVoiSelector } from './scout-voi-client.js'
import { createScout, launchScoutFlight, completeScoutFlight, scanFlight, pointAlong, MAX_FLIGHTS, FLIGHT_ANIMATION_S, SWATH_M, FLIGHT_M } from './scout.js'
import { hazardRGB, blockedSegments, reviewedMask, legendHTML, COLORS as HAZARD } from './hazards.js'
import { beliefMap } from './belief.js'
import { terrainMaterial, setImageryUVs, loadImagery, imageryCells } from './terrain.js'
import { detailTiles } from './tiles.js'
import { makeAstronaut, makeHabitat, makeHelicopter, icon, makeSky, mapFurniture, STRIDE_M } from './figures.js'
import { stretches, describe, lowestMargin, shortestAlternative } from './why.js'
import { initStops } from './stops.js'
import { initSteps } from './steps.js'
import { initTerrainClassifier } from './terrain-classifier.js'
import { explainFlight, flightText } from './scout-why.js'
import { initFlow } from './flow/flow.js'
import { initHud, nextStop, bearingDeg } from './hud.js'
import { initEyeWalk, ribbon } from './eye-walk.js'
import { initDemo } from './demo.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
// The bare link is the judges' link: the Gale demo with the demo features on.
// ?world=synthetic loads the test world; ?flags= (empty) switches every feature off (docs/PLAN.md §10).
const DEMO_FLAGS = 'drone_scout,why_flight,why_route,layers_extra,pov_images,science_stop,step_mode,detail,hazards,contours'
const worldName = params.get('world') ?? 'gale'
// Vesta Scout is the guided mission (flow/); ?vision (and the test world) keeps the map screen, which is Vesta Vision.
const demoMode = params.has('demo') // the Demo tab (demo.js): the map screen with Plan, Walk and Demo, the helmet read-outs and the walking motion
const flowMode = !demoMode && !params.has('vision') && !params.has('world') && !params.has('flags')
const listeners = {}
const emit = (evt, data) => (listeners[evt] ?? []).forEach((fn) => fn(data))
let objective = 'easiest' // or 'shortest' (flow stage 1)
let flightSeconds = null // flow: seconds a flight takes on screen; null = scout.js default
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
let flight = null // current scouting campaign; re-plan and select again after each landing
let flightsUsed = 0 // at most three flights per page/walk, including repeated clicks
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
document.title = flowMode ? 'Vesta Scout' : 'Vesta Vision'
if (!flowMode && !demoMode) document.body.classList.add('vision') // Vision: no Walk tab, no walk bar, no why-this-route (CSS in scout/index.html)
// Title in four levels (styled in scout/index.html): product, site, the energy scenario, then the grid's size.
const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text })
$('title').replaceChildren(el('span', 't-brand', flowMode ? 'Vesta Scout' : 'Vesta Vision'), el('span', 't-site', meta.site?.name ?? meta.name),
  ...(scenario ? [el('span', 't-chip', scenario.name)] : []), el('span', 't-tech', `${W}×${H} cells · ${cs} m`))

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
// The tint texture carries, per cell, what the vertex colours carry on the 8 m mesh (ring dimming, found rocks, the
// layer) for the detail tiles, and in its alpha whether the helicopter has flown there (the discover look, ticket A3).
const tint = new THREE.DataTexture(new Uint8Array(W * H * 4).fill(255), W, H, THREE.RGBAFormat)
tint.magFilter = THREE.LinearFilter
const mutedLook = flags.has('drone_scout') && !!layers.rocks_fine && !!meta.detail_tiles?.url // unflown ground is muted
const revealShared = { uTint: { value: tint }, uCells: { value: new THREE.Vector2(cs, W) }, uMuted: { value: mutedLook ? 1 : 0 },
  uHeli: { value: new THREE.Vector3(0, 0, 0) }, // uHeli: x, z of the helicopter and the scan ring's radius (0 = off)
  uScanColor: { value: flowMode ? new THREE.Color('#e3dfd3') : new THREE.Vector3(0.15, 0.85, 1.0) },
  uContour: { value: 0 }, uContourBase: { value: meta.height_offset_m ?? 0 } } // contour lines (ticket A7, flag contours)
const terrainMat = terrainMaterial(revealShared)
const terrain = new THREE.Mesh(geo, terrainMat)

const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xc9a27e) // dusty Mars sky
scene.add(makeSky())
scene.add(terrain)
scene.add(new THREE.HemisphereLight(0xffe8d0, 0x402015, 1.2))
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(-1, 0.6, -0.4) // low sun so slopes read
scene.add(sun)

const span = Math.max(W, H) * cs
const pin = () => icon('#ff3bd4', { size: 0.022 }) // the astronaut's "Mark here" marks (stops.js): fixed-size dots, like every other marker
// Real sizes (ticket F5): a 9 m habitat next to the base cell, a 1.8 m astronaut; fixed-size icons keep them findable.
const habitat = makeHabitat()
habitat.position.copy(cellPos([meta.base_cell[0] - 2, meta.base_cell[1] - 1])) // 16 m west, 8 m north of the start
scene.add(habitat)
const baseMarker = icon('#ffffff', { ring: '#111111', label: 'H' })
scene.add(baseMarker)
const pins = new THREE.Group() // science stops, rebuilt when the plan changes
scene.add(pins)
const walker = makeAstronaut({ stride: flags.has('stride') || params.has('stride') || demoMode }) // flag stride: legs and arms swing as it walks
scene.add(walker)
const walkerIcon = icon(flowMode ? '#e3dfd3' : '#35e0ff')
scene.add(walkerIcon)
const walkerGoal = cellPos(meta.base_cell) // where the walk logic says the astronaut is; the figure glides there
const altLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xd0d0d0, dashSize: span / 120, gapSize: span / 120 }))
altLine.visible = false // E5: the shortest-distance route the planner rejected
scene.add(altLine)
const beforeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xff3b30, dashSize: span / 100, gapSize: span / 150 }))
beforeLine.visible = false // the route before the scout flight, for the before/after
scene.add(beforeLine)
const routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }))
scene.add(routeLine)

// 1 m detail tiles (ticket F7, flag detail).
const tileShared = { ...revealShared, uOverlay: terrainMat.userData.uniforms.uOverlay }
let tiles = null
// Ground height at app (x, z): the 1 m surface where a tile is loaded, else the 8 m cell.
const groundAt = (x, z) => tiles?.heightAt(x, z) ?? layers.height[Math.round(z / cs) * W + Math.round(x / cs)]
function drawRouteLine() {
  const pts = []
  route.cells.forEach(([x, y], k) => {
    const [px, py] = route.cells[k - 1] ?? [x, y]
    const steps = k ? Math.ceil((cs * Math.hypot(x - px, y - py)) / 2) : 1 // a point every 2 m, so the line hugs the 1 m surface
    for (let j = 1; j <= steps; j++) {
      const ax = (px + ((x - px) * j) / steps) * cs, az = (py + ((y - py) * j) / steps) * cs
      pts.push(new THREE.Vector3(ax, groundAt(ax, az) + 1, az))
    }
  })
  routeLine.geometry.dispose()
  routeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
  if (eyeWalk) { // the red guide line (#208): a 0.5 m ribbon 0.2 m above the ground, along the same path
    const { pos, idx } = ribbon(pts.map((p) => [p.x, p.y - 0.8, p.z]), 0.5)
    guide.geometry.dispose()
    guide.geometry = new THREE.BufferGeometry()
    guide.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    guide.geometry.setIndex(idx)
    eyeWalk.restart()
  }
}

const camera = new THREE.PerspectiveCamera(50, 1, 0.3, span * 10)
const center = new THREE.Vector3(((W - 1) * cs) / 2, 0, ((H - 1) * cs) / 2)
const home = cellPos(meta.base_cell)
camera.position.set(home.x - 260, home.y + 230, home.z + 380) // start over the base, close enough to read the ground
const controls = new OrbitControls(camera, $('scene'))
controls.target.copy(home)
controls.minDistance = 4
controls.maxPolarAngle = Math.PI * 0.495 // not below the ground
const furniture = mapFurniture()
controls.enableDamping = true

function resize() {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()
// --- Views (ticket A4, Vesta Vision v0): Map (free orbit), Follow (behind the astronaut), Eye (1.7 m, first person). ---
const EYE_M = 1.7
const view = { mode: 'map', yaw: 0, pitch: -0.05, drag: null }
const viewBtn = Object.assign(document.createElement('button'), { id: 'viewBtn', type: 'button' })
viewBtn.style.cssText = 'position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(min(38vmin, 260px) + 96px);z-index:6;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #fff5;background:#141a22e6;color:#fff;font:600 14px system-ui,sans-serif'
const visionNote = Object.assign(document.createElement('div'), { hidden: true, id: 'visionNote', textContent: 'Vesta Vision · real NASA HiRISE terrain and imagery (features of about 3 m and up) · drag to look' })
visionNote.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:max(70px,calc(env(safe-area-inset-bottom) + 70px));z-index:5;max-width:min(92vw,520px);padding:6px 10px;border-radius:8px;background:#141a22cc;color:#fff;font:500 12px system-ui,sans-serif;text-align:center;pointer-events:none'
// In the Vision views the big panel is hidden (no HUD); a small bar keeps the walk controls.
const visionBar = Object.assign(document.createElement('div'), { hidden: true, id: 'visionBar' })
visionBar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:max(14px,env(safe-area-inset-bottom));z-index:6;display:flex;gap:8px'
for (const [text, id] of [['Walk / pause', 'play'], ['Step', 'step'], ['Back to start', 'reset']]) {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, onclick: () => $(id).click() })
  b.style.cssText = 'min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #fff5;background:#141a22e6;color:#fff;font:600 14px system-ui,sans-serif'
  visionBar.append(b)
}
document.body.append(viewBtn, visionNote, visionBar)
// Helmet HUD (issue #41, flag hud or ?hud; off by default): drawn over the Follow and Eye views. hud.js only draws.
// Eye-level walk (#208, flag eye_walk; on in ?vision): WASD over the terrain, a red guide line, the next stop named.
const eyeWalk = flags.has('eye_walk') || (params.has('vision') && !params.has('flags'))
  ? initEyeWalk({ speed: meta.knobs?.speed_mps ?? 1, max: [(W - 1) * cs, (H - 1) * cs] }) : null
const guide = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff2a2a, side: THREE.DoubleSide, fog: false }))
guide.visible = false
scene.add(guide)
const eyeStops = () => route.stops.map((id) => allStops().find((s) => s.id === id)).map((s) => ({ id: s.id, name: s.name ?? s.id, x: s.cell[0] * cs, z: s.cell[1] * cs }))
const hud = flags.has('hud') || params.has('hud') || demoMode ? initHud() : null
const lookDir = new THREE.Vector3()
const hudState = () => {
  camera.getWorldDirection(lookDir)
  const s = window.appState, usable = meta.energy_budget_j - s.reserve_j
  return { heading: bearingDeg(lookDir.x, lookDir.z), pos: [walker.position.x, walker.position.z], cs,
    next: nextStop(route, k, allStops(), cs), home: [meta.base_cell[0] * cs, meta.base_cell[1] * cs],
    marginJ: ringLimit(meta, walk) - s.cost_to_go_j, usableJ: usable, energyJ: walk.energy_left_j, budgetJ: meta.energy_budget_j,
    o2L: oxygenL(meta, walk.energy_left_j), t: walk.t, k, route: route.cells, speed: meta.knobs?.speed_mps ?? 1,
    stops: allStops().filter((t) => route.stops.includes(t.id)).map((t) => t.cell), project: hudProject,
    eye: view.mode === 'eye', ahead: route.cells[Math.min(k + 2, route.cells.length - 1)], canGo: k < route.cells.length - 1, go: hudGo }
}
// Street-view step (in the Eye view, with the HUD): tap the arrow on the ground, or press the up arrow or W, to walk
// two cells on along the route and turn to face the way ahead. It is the same walk as the Step button.
function hudGo() {
  $('step').click()
  $('step').click()
  view.turnTo = heading()
}
addEventListener('keydown', (e) => { if (hud && !eyeWalk && view.mode === 'eye' && (e.key === 'ArrowUp' || e.key === 'w')) { e.preventDefault(); hudGo() } })
const hudV = new THREE.Vector3()
const hudProject = (x, z) => { // app metres -> screen pixels, and whether the point is behind the camera
  hudV.set(x, groundAt(x, z) + 2, z)
  const behind = hudV.clone().applyMatrix4(camera.matrixWorldInverse).z > 0
  hudV.project(camera)
  return [((hudV.x + 1) / 2) * innerWidth, ((1 - hudV.y) / 2) * innerHeight, behind]
}
const heading = () => { // where the astronaut is going: along the route from where they stand
  const from = route?.cells[k + 1] ? walk.cell : route?.cells[k - 1]
  const next = route?.cells[k + 1] ?? walk.cell
  return from && next ? Math.atan2(-(next[0] - from[0]), -(next[1] - from[1])) : 0
}
function setView(mode) {
  view.mode = mode
  viewBtn.textContent = { map: 'View: Map', follow: 'View: Follow', eye: 'View: Eye level' }[mode]
  visionNote.hidden = visionBar.hidden = mode === 'map'
  revealShared.uContour.value = mode === 'map' && $('contours')?.checked ? 1 : 0 // contours only in the map view
  hud?.show(mode !== 'map')
  guide.visible = !!eyeWalk && mode !== 'map'
  routeLine.visible = !guide.visible // one line at a time: white on the map, red at eye level
  eyeWalk?.show(mode === 'eye')
  if (eyeWalk && mode === 'eye') { eyeWalk.place(walker.position.x, walker.position.z); visionNote.hidden = true }
  if (hud) visionNote.hidden = true // the HUD replaces the note
  document.querySelectorAll('.panel').forEach((el) => (el.style.display = mode === 'map' ? '' : 'none'))
  furniture.el.style.display = mode === 'map' ? 'flex' : 'none'
  controls.enabled = mode !== 'eye'
  walker.visible = mode !== 'eye'
  walkerIcon.visible = mode === 'map'
  scene.fog = mode === 'map' ? null : new THREE.Fog(0xd6b48e, 120, 2600) // dusty haze with distance
  camera.near = mode === 'eye' ? 0.1 : 0.3
  camera.fov = mode === 'eye' ? 70 : 50
  camera.updateProjectionMatrix()
  const head = walker.position.clone().setY(walker.position.y + EYE_M)
  if (mode === 'follow') {
    const h = heading()
    controls.target.copy(head)
    camera.position.set(head.x + Math.sin(h) * 14, head.y + 6, head.z + Math.cos(h) * 14) // 14 m behind, 6 m up
  } else if (mode === 'eye') {
    view.yaw = heading()
    view.pitch = -0.05
  } else if (camera.position.distanceTo(controls.target) < 60) {
    camera.position.set(head.x - 90, head.y + 80, head.z + 130) // back out to a map view near the astronaut
    controls.target.copy(walker.position)
  }
}
viewBtn.onclick = () => setView({ map: 'follow', follow: 'eye', eye: 'map' }[view.mode])
const canvasEl = $('scene')
canvasEl.addEventListener('pointerdown', (e) => { if (view.mode === 'eye') { view.drag = [e.clientX, e.clientY]; view.turnTo = null } })
addEventListener('pointerup', () => (view.drag = null))
addEventListener('pointermove', (e) => {
  if (view.mode !== 'eye' || !view.drag) return
  view.yaw += (e.clientX - view.drag[0]) * 0.005
  view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch + (e.clientY - view.drag[1]) * 0.005))
  view.drag = [e.clientX, e.clientY]
})
const lastHead = new THREE.Vector3()
function tickView(dt) {
  const head = walker.position.clone().setY(walker.position.y + EYE_M)
  if (view.mode === 'follow') {
    camera.position.add(head.clone().sub(lastHead)) // ride along; the user's own orbiting is kept
    controls.target.copy(head)
  } else if (view.mode === 'eye') {
    if (eyeWalk) { // free walk: the keys move you, the camera stays 1.7 m above the ground under it
      const [x, z] = eyeWalk.tick(dt, view.yaw, eyeStops())
      camera.position.set(x, groundAt(x, z) + EYE_M, z)
    } else camera.position.copy(head)
    if (view.turnTo != null) { // street-view step: ease round to face the way ahead (the short way)
      const d = Math.atan2(Math.sin(view.turnTo - view.yaw), Math.cos(view.turnTo - view.yaw))
      view.yaw += d * Math.min(1, dt * 4)
      if (Math.abs(d) < 0.01) view.turnTo = null
    }
    camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ')
  } else if (flight) {
    controls.target.lerp(heli.position, 1 - Math.exp(-dt * 3)) // watch the helicopter
    if (flight.zoom > 0) { // ease in close at take-off (a 1.2 m helicopter is invisible from far); then the user's zoom is theirs
      const dt = frameElapsed // real time, so a slow renderer still gets there
      flight.zoom -= dt
      const off = camera.position.clone().sub(controls.target)
      camera.position.copy(controls.target).add(off.setLength(THREE.MathUtils.lerp(off.length(), CHASE_M, 1 - Math.exp(-dt * 2.5))))
    }
  }
  lastHead.copy(head)
}
setView('map')

// Opening (ticket A5): start high above the whole slice, as the orbiter sees it, then ease down to the habitat.
// Any tap, scroll or key skips it; off for reduced motion and for automated tests (their clicks must not race it).
const INTRO_HOLD_S = 1.2, INTRO_FLY_S = 4
let intro = null
if (!flowMode && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.webdriver) {
  const mid = new THREE.Vector3((W * cs) / 2, home.y, (H * cs) / 2)
  const label = document.createElement('div')
  label.textContent = 'Gale crater, lower Mount Sharp · NASA MRO HiRISE'
  label.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:6;font:600 15px system-ui,sans-serif;color:#fff;text-shadow:0 1px 4px #000;pointer-events:none;transition:opacity .8s;text-align:center'
  document.body.append(label)
  intro = { t: 0, label, to: camera.position.clone(), targetTo: controls.target.clone(), from: new THREE.Vector3(mid.x, home.y + span * 1.15, mid.z + span * 0.25), targetFrom: mid }
  camera.position.copy(intro.from)
  controls.target.copy(mid)
  for (const e of ['pointerdown', 'wheel', 'keydown']) addEventListener(e, () => { if (intro) tickIntro(Infinity) }, { once: true, capture: true }) // land at once, before the tap does anything else
}
function tickIntro(dt) {
  intro.t += dt
  const k = THREE.MathUtils.smootherstep((intro.t - INTRO_HOLD_S) / INTRO_FLY_S, 0, 1)
  camera.position.lerpVectors(intro.from, intro.to, k)
  controls.target.lerpVectors(intro.targetFrom, intro.targetTo, k)
  if (k > 0.5) intro.label.style.opacity = 0
  if (k === 1) { const { label } = intro; setTimeout(() => label.remove(), 900); intro = null }
}

let lastFrame = performance.now()
let frameElapsed = 0
let lastTiles = 0
const walkClock = createPlaybackClock()
let lastWalkFrame = lastFrame
// Background tabs suspend rendering: resuming must not spend the whole hidden interval walking.
document.addEventListener('visibilitychange', () => { lastWalkFrame = performance.now() })
renderer.setAnimationLoop((now) => {
  const elapsed = Math.max(0, (now - lastFrame) / 1000)
  const dt = Math.min(elapsed, 0.1) // smooth camera/character motion, not the flight clock
  frameElapsed = Math.min(elapsed, 1)
  lastFrame = now
  if (flight?.active) tickFlight(elapsed) // spatial scanning retains every crossed sample, even on a slow frame
  const walkElapsed = Math.max(0, now - lastWalkFrame)
  lastWalkFrame = now
  if (!document.hidden && walkClock.tick(walkElapsed, advanceWalk)) render()
  // Exponential easing already handles a long frame; clamping its time made the figure lag behind the route.
  const wasX = walker.position.x, wasZ = walker.position.z
  walker.position.lerp(walkerGoal, 1 - Math.exp(-elapsed * 6))
  walker.position.y = groundAt(walker.position.x, walker.position.z)
  const moved = Math.hypot(walker.position.x - wasX, walker.position.z - wasZ), st = walker.userData.stride // one stride per STRIDE_M walked
  st.uPhase.value += (moved / STRIDE_M) * Math.PI
  st.uAmp.value += ((moved > 0.002 ? 1 : 0) - st.uAmp.value) * Math.min(1, dt * 6)
  if (walkerGoal.distanceToSquared(walker.position) > 0.01) walker.rotation.y = Math.atan2(-(walkerGoal.x - walker.position.x), -(walkerGoal.z - walker.position.z))
  walkerIcon.position.set(walker.position.x, walker.position.y + 3, walker.position.z)
  baseMarker.position.set(habitat.position.x, habitat.position.y + 12, habitat.position.z)
  if (intro) tickIntro(dt)
  tickView(dt)
  hud?.tick(hudState)
  furniture.update(camera, controls, innerHeight)
  if (tiles && now - lastTiles > 500) {
    lastTiles = now
    tiles.update([[controls.target.x, controls.target.z], [walker.position.x, walker.position.z], ...(flight ? [[heli.position.x, heli.position.z]] : [])])
  }
  if (view.mode !== 'eye') controls.update()
  renderer.render(scene, camera)
})

// --- Plan mode (block E3): layer toggles with their source, targets, route, stop previews. ---
// rocks_fine and cost_to_go_scouted stay hidden until the drone has flown (E4).
const EXTRA = ['thermal_inertia', 'science', 'dose_rate'] // THEMIS, CRISM, Curiosity RAD: flag layers_extra
const shownLayers = meta.layers.filter((n) => layers[n] && n !== 'rocks_fine' && (!EXTRA.includes(n) || flags.has('layers_extra')))
const IMAGERY = 'imagery' // HiRISE colour draped on the terrain (ticket F2); the default view when the world has it
const HAZARDS = 'hazards' // slope, blocked steps and rocks with a legend (ticket F6, flag hazards)
const WHITE = new Uint8Array(W * H * 3).fill(255)
let imageryCanvas = null // the whole-slice picture, for the flow's 2D map
let imageryRGB = null // one colour per cell, for the minimap
let layerName = 'terrain_class'
let layerColors = layerRGB(layerName, layers[layerName])
// Hazards: blocked steps (walls across crossings, crossings_blocked.json) and reviewed-rock pins (reviewed_rocks.json).
const hazardData = flags.has(HAZARDS)
  ? await Promise.all([optionalJSON('crossings_blocked.json', null), optionalJSON('reviewed_rocks.json', null)])
  : [null, null]
const [crossings, reviewedRocks] = hazardData
const reviewed = reviewedRocks ? reviewedMask(reviewedRocks.points, W, H) : null
const hazardLayer = new THREE.Group()
hazardLayer.visible = false
scene.add(hazardLayer)
if (crossings) {
  const heightAt = (x, z) => layers.height[Math.min(H - 1, Math.max(0, Math.round(z / cs))) * W + Math.min(W - 1, Math.max(0, Math.round(x / cs)))]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(blockedSegments(crossings.crossings, heightAt), 3))
  hazardLayer.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: HAZARD.blocked })))
}
for (const r of reviewedRocks?.points ?? []) {
  const p = icon('#ffffff', { ring: '#c0392b', size: 0.016 }) // a fixed-size dot: a 30 m cone broke the true scale (F5)
  p.position.set(r.x, groundAt(r.x, r.z) + 0.5, r.z)
  p.userData.label = `reviewed rock ${r.id}`
  hazardLayer.add(p)
}
// Colours for a view; Hazards and belief are computed from what is known now, not read from a file.
const colorsFor = (name) => name === IMAGERY ? (imageryRGB ?? WHITE)
  : name === HAZARDS ? hazardRGB(world, scanned, reviewed)
    : layerRGB(name, name === 'belief' ? beliefMap(world, scanned, blocked) : layers[name])
function refreshLayer() {
  if (layerName === HAZARDS || layerName === 'belief') layerColors = colorsFor(layerName)
}
function setLayer(name) {
  layerName = name
  layerColors = colorsFor(name)
  terrainMat.userData.uniforms.uOverlay.value = name === IMAGERY ? 0 : 1
  hazardLayer.visible = name === HAZARDS
  $('legend').hidden = name !== HAZARDS
  document.querySelectorAll('#layers input').forEach((el) => (el.checked = el.value === name))
}
$('legend').innerHTML = legendHTML(meta, { blocked: crossings?.crossings.length ?? 0, reviewed: reviewedRocks?.points.length ?? 0 })
$('sources').textContent = meta.sources?.all ?? '' // applies to every layer without its own source
const BELIEF = flags.has('belief') ? ['belief'] : [] // chance of hidden rocks (belief map v1, flag belief)
// Five named views (ticket F6); every other layer stays reachable under "Advanced".
const VIEWS = [
  [IMAGERY, 'Imagery', !!meta.detail_tiles?.url],
  [HAZARDS, 'Hazards', flags.has(HAZARDS) && !!layers.slope],
  ['cost_to_go', 'Energy home', !!layers.cost_to_go],
  ['science', 'Science', shownLayers.includes('science')],
  ['dose_rate', 'Radiation', shownLayers.includes('dose_rate')],
].filter(([, , on]) => on)
const named = new Set(VIEWS.map(([n]) => n))
const advanced = [...shownLayers.filter((n) => !named.has(n)), ...BELIEF]
const layerSource = (name) => name === 'belief'
  ? 'Predicted chance of hidden rocks from 8 m slope and relief (HiRISE terrain); scouted cells show what was found. Estimate'
  : name === IMAGERY
    ? 'MRO · HiRISE colour (USGS MSL Gale LRGB 25 cm mosaic) · NASA/JPL-Caltech/University of Arizona'
    : name === HAZARDS
      ? 'Slope and steps from the USGS MSL Gale DEM (MRO HiRISE); rocks: ROSCO reviewed, others estimated'
      : sourceLabel(meta, name)
function viewRadio(name, title) {
  const label = document.createElement('label')
  label.innerHTML = `<input type="radio" name="layer"><span><b></b><small></small></span>`
  label.querySelector('input').checked = name === layerName
  label.querySelector('input').value = name
  label.querySelector('b').textContent = title
  label.querySelector('small').textContent = layerSource(name)
  label.querySelector('input').onchange = () => {
    setLayer(name)
    render()
  }
  return label
}
const more = document.createElement('details')
more.innerHTML = '<summary>Advanced</summary>'
more.append(...advanced.map((n) => viewRadio(n, n.replaceAll('_', ' '))))
$('layers').append(...VIEWS.map(([n, title]) => viewRadio(n, title)), ...(advanced.length ? [more] : []))
// Contour lines (ticket A7): drawn on top of whichever view is on, so they are a toggle, not a view.
if (flags.has('contours')) {
  const c = document.createElement('label')
  c.innerHTML = '<input type="checkbox" id="contours"><span><b>Contours</b><small>Every 5 m, bold every 25 m · USGS MSL Gale DEM (MRO HiRISE stereo)</small></span>'
  c.querySelector('input').onchange = (e) => { revealShared.uContour.value = e.target.checked && view.mode === 'map' ? 1 : 0 }
  $('layers').prepend(c)
}

const kj = (j) => `${Math.round(Math.max(j, 0) / 1000)} kJ`

// --- Science stops and the planned route. Targets come from targets.json (picked from the data);
// the crew can add their own by tapping the minimap. The planner picks the order and the path. ---
const custom = [] // stops the crew added
const included = new Set(flowMode ? [] : targets.map((t) => t.id)) // the guided mission starts with no stops chosen
let selected = null
let route // { cells, stops, dropped, energy_j, minutes }
let blocked = null // rocks the scout has found (E4); the planner routes around them
const allStops = () => [...targets, ...custom]

let scoutBefore = null // { cells, energy_j, crossed }: the route before the last scout, for E5
function replan(keepBefore = false, planned = null) {
  beforeLine.visible = keepBefore
  if (!keepBefore) scoutBefore = null
  if (!keepBefore) $('scoutStatus').textContent = ''
  route = planned ?? planTour(world, allStops().filter((s) => included.has(s.id)), blocked)
  if (!planned && objective === 'shortest' && route.stops.length) { // same stops in the same order, by least distance; energy re-measured
    const cells = shortestAlternative(world, route.stops.map((id) => allStops().find((s) => s.id === id).cell), blocked)
    const d = describe(world, cells, blocked)
    route = { ...route, cells, energy_j: d.energy_j, minutes: d.minutes }
  }
  refreshLayer()
  routeLine.geometry.dispose()
  drawRouteLine()
  if (flags.has('why_route')) explain()
  reset() // a new plan starts a new walk; reset also draws the stops
  emit('plan', route)
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
    const p = icon(!on ? '#8a8a8a' : route.dropped.includes(s.id) ? '#ff5a3d' : s.custom ? '#ff9f1c' : '#ffd23f',
      { label: String(allStops().indexOf(s) + 1), size: s.id === selected ? 0.042 : 0.03 })
    p.position.copy(cellPos(s.cell, 3))
    pins.add(p)
  }
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const name = (id) => allStops().find((s) => s.id === id)?.name ?? id
  if (route.stops.length) { // the numbers first, then the order of the walk
    const stat = (big, rest) => { const d = el('span', 'r-stat', ''); d.append(el('b', '', big), ` ${rest}`); return d }
    const stats = el('div', 'r-stats', '')
    stats.append(stat(kj(route.energy_j), `of ${kj(usable)} usable`), stat(`${Math.round(route.minutes)} min`, 'walking'), stat(String(route.stops.length), 'stops'))
    const path = el('ol', 'r-path', '')
    path.append(...['Base', ...route.stops.map(name), 'Base'].map((n) => el('li', '', n)))
    $('route').replaceChildren(stats, path)
  } else $('route').textContent = included.size ? 'None of the chosen stops fits in one walk with the reserve kept.' : 'No stops chosen yet.'
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
    box.disabled = !!flight
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
  if (flight) return
  custom.splice(custom.findIndex((s) => s.id === id), 1)
  included.delete(id)
  if (selected === id) (selected = null), $('detail').replaceChildren()
  replan()
}

let customCount = 0
// Tap the minimap (plan tab): on your own stop removes it, on a target toggles it, elsewhere adds a stop.
$('map').addEventListener('click', (e) => {
  if ($('plan').hidden || flight) return
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
const ALT = 10 // flying height above the ground, metres (knob; docs/DECISION-BRIEFS.md §4)
function makeHeli() {
  const g = makeHelicopter()
  const beam = new THREE.Mesh(new THREE.ConeGeometry(15, ALT, 24, 1, true), // 15 m = SWATH_M
    new THREE.MeshBasicMaterial({ color: flowMode ? 0xe3dfd3 : 0x35e0ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }))
  beam.position.y = -ALT / 2
  g.add(beam)
  g.userData.beam = beam
  scene.add(g)
  return g
}
const heli = makeHeli()
const CHASE_M = 14 // camera distance while it follows a flight
// Three helicopters, as in NASA's SkyFall concept; parked beside the habitat between flights. One flies at a time.
const padAt = (k) => { const x = habitat.position.x + 11 + k * 3, z = habitat.position.z + 5 - k * 2.5; return new THREE.Vector3(x, groundAt(x, z), z) }
const parked = [1, 2].map((k) => { const h = makeHelicopter(); h.position.copy(padAt(k)); scene.add(h); return h })
function parkHeli() {
  heli.position.copy(padAt(0))
  heli.rotation.set(0, 0, 0)
  heli.userData.beam.visible = false
  heli.visible = true
}
parkHeli()
setInterval(() => { // keep the parked ones on the ground as the 1 m tiles load under them
  for (const h of flight ? parked : [heli, ...parked]) h.position.y = groundAt(h.position.x, h.position.z)
}, 500)
const heliIcon = icon('#ffffff', { ring: flowMode ? '#e3dfd3' : '#35e0ff', label: '✈' })
heliIcon.visible = false
scene.add(heliIcon)
function placeHeli(h, [x, y], alt = ALT) {
  const to = new THREE.Vector3(x * cs, groundAt(x * cs, y * cs) + alt, y * cs)
  const dx = to.x - h.position.x, dz = to.z - h.position.z
  if (dx * dx + dz * dz > 1e-4) h.rotation.set(0.12, Math.atan2(dx, dz), 0, 'YXZ') // nose along the track, tilted forward a little
  h.position.copy(to)
  h.userData.beam.scale.y = alt / ALT // the scan cone always reaches the ground
  h.userData.beam.position.y = -alt / 2
}
const dotPos = new Float32Array(W * H * 3)
const dotCol = new Float32Array(W * H * 3)
const scanDotColor = flowMode ? new THREE.Color('#c5a065').toArray() : [1, 0.2, 0.15]
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
    if (!rock) continue // clear ground shows by turning to full colour (the discover look); only rocks get a dot
    dotPos.set([(i % W) * cs, layers.height[i] + 0.5, Math.floor(i / W) * cs], dots * 3)
    dotCol.set(scanDotColor, dots * 3)
    dots++
  }
  if (fresh.length) {
    dotsGeo.attributes.position.needsUpdate = dotsGeo.attributes.color.needsUpdate = true
    dotsGeo.setDrawRange(0, dots)
  }
  return rocks
}

const logFlight = flags.has('why_flight') ? mountFlightLog($('scoutBox'), world) : null
const selectVoi = flags.has('voi') ? createVoiSelector(world) : null
if (flags.has('drone_scout') && layers.rocks_fine) $('scoutBox').hidden = false
$('scout').onclick = async () => {
  if (flight || flightsUsed >= MAX_FLIGHTS) return
  flight = createScout(world, allStops().filter((s) => included.has(s.id)), { scanned, maxFlights: MAX_FLIGHTS - flightsUsed })
  flight.before = route
  flight.found = 0
  pause()
  $('scout').disabled = true
  listStops()
  if (!await startNextFlight()) { land(); return }
  tickFlight(0)
}

async function startNextFlight() {
  if (flight.flights.length >= flight.maxFlights) return false
  let next
  if (selectVoi) {
    heliIcon.visible = scanDots.visible = false
    parkHeli()
    revealShared.uHeli.value.z = 0
    $('scoutStatus').textContent = 'Comparing possible flights… experimental, uncalibrated belief model.'
    try {
      const choice = await selectVoi(flight)
      flight.voiNote = choice.reason + ' Experimental value estimates; belief probabilities are not calibrated.'
      next = launchScoutFlight(world, flight, () => choice.flight)
    } catch {
      flight.voiNote = 'Experimental selection unavailable; used the route-following baseline.'
      next = launchScoutFlight(world, flight)
    }
  } else next = launchScoutFlight(world, flight)
  if (next) {
    flight.along = 0
    emit('flight:start', { n: flightsUsed + 1, of: MAX_FLIGHTS, metres: next.metres, waypoints: next.waypoints, kind: next.kind })
    flight.zoom = 3 // seconds of easing the camera in
    flight.camOff ??= camera.position.clone().sub(controls.target) // put back after the last landing
    heli.userData.beam.visible = heli.visible = heliIcon.visible = scanDots.visible = true
  }
  return !!next
}

function tickFlight(dt) {
  heli.userData.spin(dt)
  const f = flight.active
  flight.along = Math.min(f.metres, flight.along + (f.metres / (flightSeconds ?? FLIGHT_ANIMATION_S)) * dt) // slow enough to see the discovery
  const fresh = scanFlight(meta, scanned, f, flight.along)
  flight.found += reveal(fresh)
  if (fresh.length) emit('scan', { n: flightsUsed + 1, along: flight.along, seen: fresh.length, rocks: fresh.filter((i) => layers.rocks_fine[i]) })
  const climb = Math.min(1, flight.along / 20, (f.metres - flight.along) / 20) // take off and land over 20 m (drawn only; the scan is unchanged)
  placeHeli(heli, pointAlong(meta, f.waypoints, flight.along) ?? f.waypoints.at(-1), Math.max(0.3, ALT * climb))
  heliIcon.position.copy(heli.position)
  heliIcon.visible = camera.position.distanceTo(heli.position) > 60 // close up, show the helicopter itself, not its map icon
  revealShared.uHeli.value.set(heli.position.x, heli.position.z, 4 + ((performance.now() / 60) % 16))
  if (fresh.length) render()
  $('scoutStatus').textContent = `Flight ${flightsUsed + 1} of ${MAX_FLIGHTS} (${f.kind}) · ${flight.found} rock cells found · ` +
    `simulated helicopter flight, rocks from ${sourceLabel(meta, 'rocks_fine') || meta.sources?.all || 'rocks_fine'}`
  emit('flight:tick', { n: flightsUsed + 1, of: MAX_FLIGHTS, along: flight.along, metres: f.metres, found: flight.found, x: heli.position.x, z: heli.position.z })
  if (flight.along < f.metres) return

  const completed = completeScoutFlight(world, flight)
  flightsUsed++
  logFlight?.(completed, flight.targets, flightsUsed)
  { const summary = explainFlight(world, completed, flight.targets); emit('flight:end', { n: flightsUsed, of: MAX_FLIGHTS, summary, text: flightText(summary, flightsUsed) }) }
  blocked = flight.blocked
  const before = flight.before
  const crossed = new Set(before.cells.filter(([x, y]) => blocked[y * W + x]).map(([x, y]) => y * W + x)).size
  scoutBefore = { cells: before.cells, energy_j: before.energy_j, crossed }
  beforeLine.geometry.dispose()
  beforeLine.geometry = new THREE.BufferGeometry().setFromPoints(before.cells.map((c) => cellPos(c, 1.5)))
  beforeLine.computeLineDistances()
  replan(true, flight.route)
  beforeLine.visible = crossed > 0
  startNextFlight().then((started) => { if (!started) land() })
}

function land() {
  const { before, found, voiNote, flights, camOff } = flight
  flight = null
  heliIcon.visible = scanDots.visible = false
  parkHeli()
  if (camOff && view.mode === 'map') { controls.target.copy(cellPos(meta.base_cell)); camera.position.copy(controls.target).add(camOff) }
  revealShared.uHeli.value.z = 0
  $('scout').disabled = flightsUsed >= MAX_FLIGHTS
  $('scout').textContent = flightsUsed >= MAX_FLIGHTS ? '3 flights used' : 'Scout remaining route'
  listStops()
  const fullyScanned = route.cells.every(([x, y]) => scanned[y * W + x])
  $('scoutStatus').textContent = `${flightsUsed} of ${MAX_FLIGHTS} flights used · ${found} rock cells found. ${flights.length ? 'Re-planned after every flight' : 'Route unchanged'}: ` +
    `${kj(before.energy_j)} → ${kj(route.energy_j)}. ` +
    (fullyScanned ? 'The final route is fully scouted.' : 'Unscouted ground remains on this route.') +
    ' Simulated corridor flights; repositioning, recharge and helicopter energy excluded.' +
    (voiNote ? ` ${voiNote}` : '')
  emit('landed', { before, after: route, found, crossed: scoutBefore?.crossed ?? 0, flightsUsed, flightsLeft: MAX_FLIGHTS - flightsUsed, fullyScanned })
}

// --- Walk (block E2): along the planned route, energy and oxygen drain, ring, point of no return. ---
let walk, k
// Block E6 (flags science_stop, step_mode): stop checklist, markers, warnings, walk log; real steps. Off: null.
const field = flowMode || demoMode ? null : (flags.has('science_stop') || flags.has('step_mode')) // the mission's walk preview has no checklists to stop it
  ? initStops({ world, checklist: flags.has('science_stop'), flags, photos, scene, pin, cellPos, span, getWalk: () => walk, panel: $('walk'), map })
  : null
const steps = flowMode || demoMode ? null : flags.has('step_mode')
  ? initSteps({ panel: $('walk'), cs, segment: () => (k < route.cells.length - 1 ? [route.cells[k], route.cells[k + 1]] : null), blocked: () => !!field?.blocking(), step })
  : null
function reset() {
  walkClock.reset()
  pause()
  walk = startWalk(meta)
  k = 0
  field?.reset(route, allStops())
  document.body.classList.remove('danger')
  drawStops()
  render()
  snapWalker()
}

// Called once per crossed cell, including on slow frames; render() is batched by the animation loop.
function advanceWalk() {
  if (flight || k >= route.cells.length - 1 || walk.energy_left_j <= 0 || field?.blocking()) { pause(); return false }
  if (stepTo(world, walk, route.cells[++k])) buzz()
  rememberGround()
  if (field?.arrive(k)) pause()
  emit('walk:step', { k }) // the guided Visit step can pause exactly here, before the next cell
  if (k >= route.cells.length - 1 || walk.energy_left_j <= 0) pause()
  return walkClock.playing
}

function step() {
  if (flight) return
  advanceWalk()
  render()
}

function play() {
  if (flight) return
  unlockAudio()
  if (!walkClock.playing) lastWalkFrame = performance.now()
  walkClock.play()
  $('play').textContent = 'Pause'
}
function pause() {
  walkClock.pause()
  $('play').textContent = 'Walk'
}

// Reset/seek are jumps, not a flight across the intervening terrain. Keep the chase camera's offset.
function snapWalker() {
  const previous = walker.position.clone()
  walker.position.copy(walkerGoal)
  walker.position.y = groundAt(walker.position.x, walker.position.z)
  walker.rotation.y = heading()
  if (view.mode === 'follow') {
    camera.position.add(walker.position.clone().sub(previous))
    controls.target.copy(walker.position).y += EYE_M
  }
  lastHead.copy(walker.position).y += EYE_M
}

// Ground the crew already knows first-hand: within 60 m of the habitat. Drawn in full colour from the start.
const nearHome = Uint8Array.from({ length: W * H }, (_, i) => Math.hypot((i % W) - meta.base_cell[0], Math.floor(i / W) - meta.base_cell[1]) * cs <= 60)

function rememberGround() {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { // the astronaut sees the ground around them first-hand
    const x = walk.cell[0] + dx, y = walk.cell[1] + dy
    if (x >= 0 && y >= 0 && x < W && y < H && dx * dx + dy * dy <= 9) nearHome[y * W + x] = 1
  }
}

function render() {
  const inside = ringMask(ctg, ringLimit(meta, walk))
  rememberGround()
  const vertexBase = layerName === IMAGERY ? WHITE : layerColors // the image itself carries the colour in the Imagery view
  for (let i = 0; i < W * H; i++) {
    const f = inside[i] ? 1 : 0.45
    if (rockSeen(i)) colors.array.set(flowMode ? [197, 160, 101] : [200, 35, 35], i * 3)
    else for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = vertexBase[i * 3 + c] * f
    tint.image.data.set([colors.array[i * 3], colors.array[i * 3 + 1], colors.array[i * 3 + 2], scanned[i] || nearHome[i] ? 255 : 0], i * 4)
  }
  colors.needsUpdate = tint.needsUpdate = true
  walkerGoal.copy(cellPos(walk.cell))
  if (!flowMode) paintMinimap(inside) // the guided mission draws its own map; this canvas is hidden

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

$('play').onclick = () => (walkClock.playing ? pause() : play())
$('step').onclick = () => (unlockAudio(), step())
$('reset').onclick = reset
replan()

// Real imagery (ticket F2): drape HiRISE on the terrain and make it the default view; it sharpens as tiles arrive.
loadImagery(meta, renderer, (canvas) => {
  imageryRGB = imageryCells(canvas, W, H)
  imageryCanvas = canvas
  emit('imagery', canvas)
  if (layerName === IMAGERY) { layerColors = imageryRGB; render() }
}).then((imagery) => {
  if (!imagery) return
  terrainMat.map = imagery.texture
  terrainMat.userData.uniforms.uHasMap.value = 1
  terrainMat.needsUpdate = true
  setLayer(IMAGERY)
  render()
}).catch(() => {}) // no network or no tiles: the class colours stay

// 1 m detail near what you look at and near the astronaut (ticket F7); fewer tiles on small screens to save memory.
if (flags.has('detail')) {
  detailTiles(meta, scene, renderer, tileShared, () => {
    const holes = tiles.holes(), u = terrainMat.userData.uniforms
    holes.forEach((h, k) => u.uHoles.value[k].set(...h))
    u.uHoleCount.value = holes.length
    if (route) drawRouteLine()
  }, { maxTiles: Math.min(innerWidth, innerHeight) < 600 ? 4 : 9 }).then((t) => (tiles = t)).catch(() => {})
}
// --- The guided mission (docs/UX-PLAN.md): flow/ draws the stages; this object is all it may touch. ---
const app = {
  world, meta, W, H, cs, MAX_FLIGHTS,
  usableJ: meta.energy_budget_j * (1 - meta.reserve_fraction),
  on(evt, fn) { (listeners[evt] ??= []).push(fn); return () => listeners[evt].splice(listeners[evt].indexOf(fn), 1) },
  stops: () => allStops().map((s) => ({ ...s, included: included.has(s.id), dropped: route.dropped.includes(s.id), photo: photos.find((p) => p.target_id === s.id) })),
  toggleStop(id) { if (flight) return; included.has(id) ? included.delete(id) : included.add(id); replan() },
  addStop(cell) { if (flight) return; const id = `C${++customCount}`; custom.push({ id, name: `Your stop ${customCount}`, cell, custom: true, why: 'Picked on the map.' }); included.add(id); replan() },
  removeStop(id) { if (flight) return; const c = custom.findIndex((s) => s.id === id); if (c >= 0) custom.splice(c, 1); included.delete(id); replan() },
  route: () => route, // { cells, stops, dropped, energy_j, minutes }
  maxSlopeDeg: meta.knobs.max_slope_deg,
  hazardColors: () => hazardRGB(world, scanned, reviewed), // Uint8Array(W*H*3): green walkable, amber near the limit, red too steep or rock
  // Cells on the straight line between two cells (for "the simplest plan"), both ends included.
  line([x0, y0], [x1, y1]) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; return Array.from({ length: n + 1 }, (_, t) => [Math.round(x0 + ((x1 - x0) * t) / n), Math.round(y0 + ((y1 - y0) * t) / n)]) },
  describe: (cells) => describe(world, cells, blocked), // { metres, energy_j, minutes, steepest_deg, sand_share, climb_m, ... }
  // Shift the 3D picture right by `px` so its centre sits in the middle of the area the rail leaves free (0 = centred).
  viewShift(px, py = 0) { px || py ? camera.setViewOffset(innerWidth, innerHeight, -px, py, innerWidth, innerHeight) : camera.clearViewOffset() }, // py: shift up
  objective: () => objective,
  setObjective(o) { if (flight) return; objective = o; replan() },
  scanned, // Uint8Array(W*H): 1 where a helicopter has looked
  rockSeen: (i) => !!rockSeen(i),
  blocked: () => blocked,
  belief: () => beliefMap(world, scanned, blocked), // Float32Array(W*H) chance of a hidden rock; experimental
  imagery: () => imageryCanvas, // 2048 px canvas of the slice, north up, or null until loaded ('imagery' event)
  orbitalImageUrl: meta.files.optical ? `${base}/${meta.files.optical}` : null,
  scout: {
    start: () => $('scout').click(),
    flying: () => !!flight, used: () => flightsUsed, left: () => MAX_FLIGHTS - flightsUsed,
    before: () => scoutBefore, // { cells, energy_j, crossed } of the route before the last scout, or null
    seconds(v) { flightSeconds = v }, // how long one flight takes on screen
    // A dry run for stage 2: the first flight the scout would fly now ({ waypoints: [[x, y], ...] cells, metres, kind }) or null. Nothing is flown.
    preview() {
      const dry = createScout(world, allStops().filter((s) => included.has(s.id)), { scanned: Uint8Array.from(scanned), maxFlights: MAX_FLIGHTS - flightsUsed })
      return launchScoutFlight(world, dry)
    },
    swathM: SWATH_M, flightM: FLIGHT_M,
  },
  walk: { play, pause, reset, step, playing: () => walkClock.playing,
    speed: (ms) => walkClock.speed(ms), // milliseconds per grid step (120 = normal)
    seek(n) { const on = walkClock.playing; reset(); while (k < Math.min(n, route.cells.length - 1)) stepTo(world, walk, route.cells[++k]); render(); snapWalker(); if (on) play() }, // jump to step n
    state: () => ({ k, of: route.cells.length - 1, energy_left_j: walk.energy_left_j }) },
  // Cameras: 'habitat' (third person beside the astronaut and the habitat), 'walker' (behind the astronaut), 'map'.
  camera(mode) {
    if (mode === 'walker') return setView('follow')
    setView('map')
    if (mode === 'habitat') { // low, beside the astronaut, the habitat behind; the subject sits lower right so the centre is free for the 2D map
      const b = cellPos(meta.base_cell), hab = habitat.position
      controls.target.set((b.x + hab.x) / 2, groundAt(b.x, b.z) + 2.4, (b.z + hab.z) / 2)
      const cx = b.x + 12, cz = b.z + 20
      camera.position.set(cx, Math.max(groundAt(cx, cz) + 2, groundAt(b.x, b.z) + 4.5), cz)
    }
  },
}
if (flowMode) initFlow(app)
else if (demoMode) { // one mission played through with captions, on the real hooks above
  initDemo(app, { setLayer: (n) => { if (n !== IMAGERY || imageryRGB) setLayer(n); render() },
    contours: (on) => { if ($('contours')) $('contours').checked = on; revealShared.uContour.value = on && view.mode === 'map' ? 1 : 0 },
    counts: { blocked: crossings?.crossings.length ?? 0, reviewed: reviewedRocks?.points.length ?? 0 },
    validation: await optionalJSON('validation.json', null) })
}
window.vesta = { app, camera, controls, walker, tiles: () => tiles, groundAt, setView, view } // for checks from the console and tests
