import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadWorld, layerRGB } from './world.js'

const status = document.getElementById('status')
const worldName = new URLSearchParams(location.search).get('world') ?? 'synthetic'

let world
try {
  world = await loadWorld(`${import.meta.env.BASE_URL}${worldName}`)
} catch (e) {
  status.textContent = `Could not load world "${worldName}": ${e.message}`
  throw e
}
const { meta, layers } = world
const { width: W, height: H, cell_size_m: cs } = meta
status.textContent = `${meta.name} · ${W}×${H} cells · ${cs} m`

// --- 3D view: visual only, no route maths here (docs/CRITIQUE.md). ---
// One vertex per cell; cell (x, y) sits at (x*cs, height, y*cs), so +z is south and north is -z.
const geo = new THREE.PlaneGeometry((W - 1) * cs, (H - 1) * cs, W - 1, H - 1)
geo.rotateX(-Math.PI / 2) // PlaneGeometry's first vertex row becomes the north edge, matching row 0
geo.translate(((W - 1) * cs) / 2, 0, ((H - 1) * cs) / 2)
const pos = geo.attributes.position
for (let i = 0; i < W * H; i++) pos.setY(i, layers.height[i])
geo.computeVertexNormals()
geo.setAttribute('color', new THREE.BufferAttribute(layerRGB('terrain_class', layers.terrain_class), 3, true))
const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xc9a27e) // dusty Mars sky
scene.add(terrain)
scene.add(new THREE.HemisphereLight(0xffe8d0, 0x402015, 1.2))
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(-1, 0.6, -0.4) // low sun so slopes read
scene.add(sun)

const span = Math.max(W, H) * cs
const [bx, by] = meta.base_cell
const base = new THREE.Mesh(new THREE.ConeGeometry(span / 120, span / 40, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }))
base.position.set(bx * cs, layers.height[by * W + bx] + span / 80, by * cs)
scene.add(base)

const camera = new THREE.PerspectiveCamera(50, 1, span / 1000, span * 10)
const center = new THREE.Vector3(((W - 1) * cs) / 2, 0, ((H - 1) * cs) / 2)
camera.position.set(center.x, span * 0.6, center.z + span * 0.8)
const controls = new OrbitControls(camera, canvas)
controls.target.copy(center)
controls.enableDamping = true
controls.update()

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

// --- Minimap: flat, north up, one pixel per cell, coloured by the chosen layer. ---
const map = document.getElementById('map')
map.width = W
map.height = H
const ctx = map.getContext('2d')
const select = document.getElementById('layer')
select.append(...Object.keys(layers).map((name) => new Option(name.replaceAll('_', ' '), name)))
select.value = 'terrain_class'

function paintMinimap() {
  const rgb = layerRGB(select.value, layers[select.value])
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < W * H; i++) img.data.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255], i * 4)
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = '#fff'
  ctx.fillRect(bx - 1, by - 1, 3, 3) // base
}
select.addEventListener('change', paintMinimap)
paintMinimap()
