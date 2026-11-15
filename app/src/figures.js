// Things drawn at their real size (rescope ticket F5, docs/SPEC.md pillar A3): 1 unit = 1 m, origin on the ground.
// Simple built-in shapes until the glTF models of ticket A1 replace them. Sizes: astronaut 1.8 m; helicopter with a
// 1.2 m rotor (Ingenuity's rotor span; NASA/JPL); habitat about 9 m across (our design, not a NASA vehicle).
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import ingenuityUrl from './models/ingenuity.glb?url'
import suitUrl from './models/z2-spacesuit.glb?url'
import habitatUrl from './models/habitat-demonstration-unit.glb?url'

// NASA models (ticket A1; sources and credits in models/README.md) replace the built-in shapes once they load.
// size: metres along `axis` after scaling; the model is then centred with its lowest point on the ground.
const loader = new GLTFLoader()
function useModel(g, url, { size, axis = 'y', turn = 0 }, then) {
  const old = [...g.children]
  loader.loadAsync(url).then(({ scene: m }) => {
    m.traverse((o) => { if (o.material) Object.assign(o.material, { transmission: 0, transparent: false, metalness: Math.min(o.material.metalness, 0.2), side: THREE.DoubleSide }) }) // some NASA exports mark everything as glass; metal is black without an environment map
    m.rotation.y = turn
    const box = new THREE.Box3().setFromObject(m)
    m.scale.setScalar(size / box.getSize(new THREE.Vector3())[axis])
    box.setFromObject(m)
    const c = box.getCenter(new THREE.Vector3())
    m.position.set(-c.x, -box.min.y, -c.z)
    g.remove(...old)
    g.add(m)
    then?.(m)
  }).catch(() => {}) // the built-in shapes stay
}

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.35, ...extra }) // a little self-lit so the shaded side still reads
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
const at = (mesh, x, y, z) => (mesh.position.set(x, y, z), mesh)

// Walking motion for the Z-2 suit (flag stride): the model is one mesh with no skeleton, so the vertex shader swings
// the legs and arms about the hips and shoulders, opposite sides out of step. In the mesh's own space the feet are
// at z = 0, the head at z = -1.93, x is left-right and y is front-back (read from the file's bounds). An estimate
// of a walk for the eye, not a simulation of the suit's joints.
export const STRIDE_M = 1.3
function addStride(model, u) {
  model.traverse((o) => {
    if (!o.isMesh) return
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uPhase;\nuniform float uAmp;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            float h = -transformed.z / 1.926;                // 0 at the feet, 1 at the top of the helmet
            float side = sign(transformed.x);
            float sw = sin(uPhase) * uAmp;
            float leg = smoothstep(0.50, 0.40, h) * smoothstep(0.0, 0.03, abs(transformed.x));
            float arm = smoothstep(0.20, 0.27, abs(transformed.x)) * smoothstep(0.80, 0.70, h) * step(0.40, h);
            float a = side * sw * 0.50 * leg - side * sw * 0.42 * arm;   // arms swing against the legs
            float pz = -1.926 * (leg > 0.0 ? 0.50 : 0.78);  // hip or shoulder height
            float py = 0.10;
            float c = cos(a), s = sin(a);
            vec2 d = vec2(transformed.y - py, transformed.z - pz);
            transformed.y = py + c * d.x - s * d.y;
            transformed.z = pz + s * d.x + c * d.y;
            transformed.z -= abs(sin(uPhase)) * 0.03 * uAmp;  // a small rise at mid-stride
          }`)
    }
    o.material.needsUpdate = true
  })
}

export function makeAstronaut({ stride = false } = {}) {
  const g = new THREE.Group(), suit = mat(0xf2f2f2), dark = mat(0x3a3f47)
  g.add(at(box(0.16, 0.8, 0.2, suit), -0.11, 0.4, 0), at(box(0.16, 0.8, 0.2, suit), 0.11, 0.4, 0)) // legs
  g.add(at(box(0.5, 0.62, 0.3, suit), 0, 1.11, 0)) // torso
  g.add(at(box(0.13, 0.6, 0.15, suit), -0.32, 1.1, 0), at(box(0.13, 0.6, 0.15, suit), 0.32, 1.1, 0)) // arms
  g.add(at(box(0.44, 0.6, 0.2, dark), 0, 1.15, 0.24)) // life-support pack on the back (+z is behind)
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), suit), 0, 1.61, 0)) // helmet, top at 1.8 m
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), mat(0xd9a441, { metalness: 0.9, roughness: 0.25 })), 0, 1.61, -0.07)) // visor
  g.add(at(box(0.5, 0.05, 0.3, mat(0x35e0ff, { emissive: 0x35e0ff, emissiveIntensity: 0.6 })), 0, 0.82, 0)) // belt, so it reads from above
  g.userData.stride = { uPhase: { value: 0 }, uAmp: { value: 0 } }
  useModel(g, suitUrl, { size: 1.8, turn: Math.PI }, stride ? (m) => addStride(m, g.userData.stride) : undefined) // NASA Z-2 suit; it faces +z, the walker faces -z
  return g
}

export function makeHabitat() {
  const g = new THREE.Group(), hull = mat(0xe9e6df), metal = mat(0x8d9199, { metalness: 0.6, roughness: 0.45 })
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 3.4, 28), hull), 0, 3.3, 0)) // crew cabin
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(3.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), hull), 0, 5, 0)) // dome
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.35, 28), metal), 0, 1.6, 0)) // deck ring
  for (let k = 0; k < 4; k++) { // landing legs
    const a = (k * Math.PI) / 2 + Math.PI / 4, leg = box(0.28, 2.6, 0.28, metal)
    leg.position.set(Math.cos(a) * 4.4, 1.05, Math.sin(a) * 4.4)
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45)
    g.add(leg, at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14), metal), Math.cos(a) * 4.95, 0.06, Math.sin(a) * 4.95))
  }
  g.add(at(box(1.5, 2.2, 1.4, hull), 0, 2.7, 4.3)) // airlock, facing south
  g.add(at(box(1.0, 1.9, 0.08, mat(0x3a3f47)), 0, 2.65, 5.02)) // hatch (2 m tall: the human-scale cue)
  const ramp = box(1.3, 0.1, 3.4, metal)
  ramp.position.set(0, 0.85, 6.5)
  ramp.rotation.x = 0.5
  g.add(ramp)
  const glow = mat(0xffc56b, { emissive: 0xffb347, emissiveIntensity: 1.4 })
  for (let k = 0; k < 6; k++) { // lit windows
    const a = (k * Math.PI) / 3 + 0.5
    g.add(at(box(0.7, 0.5, 0.1, glow), Math.cos(a) * 3.85, 3.9, Math.sin(a) * 3.85)).children.at(-1).lookAt(0, 3.9, 0)
  }
  const panel = mat(0x1d2f5c, { metalness: 0.5, roughness: 0.35 })
  g.add(at(box(6, 0.08, 2.2, panel), -7.6, 3.2, 0), at(box(6, 0.08, 2.2, panel), 7.6, 3.2, 0)) // solar wings
  g.add(at(box(0.12, 0.12, 0.12, metal), 0, 0, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), metal), 1.2, 8, 0)) // mast
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat(0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 2 })), 1.2, 9.5, 0)) // beacon
  useModel(g, habitatUrl, { size: 9.7, axis: 'x' }) // NASA Habitat Demonstration Unit
  return g
}

// Ingenuity-like: two counter-rotating rotors of 1.2 m, a small body, four legs, a solar panel on top.
export function makeHelicopter() {
  const g = new THREE.Group(), body = mat(0xd8c9a3, { metalness: 0.4 }), dark = mat(0x1c1c1c)
  g.add(at(box(0.14, 0.16, 0.16, body), 0, 0.2, 0))
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 5), dark), x * 0.16, 0.12, z * 0.16)
    leg.rotation.set(z * 0.7, 0, -x * 0.7)
    g.add(leg)
  }
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), dark), 0, 0.42, 0))
  const r1 = at(box(1.2, 0.012, 0.07, dark), 0, 0.42, 0), r2 = at(box(1.2, 0.012, 0.07, dark), 0, 0.5, 0)
  g.add(r1, r2, at(box(0.42, 0.01, 0.16, mat(0x1d2f5c, { metalness: 0.5 })), 0, 0.58, 0))
  g.userData.spin = (dt) => { r1.rotation.y += dt * 40; r2.rotation.y -= dt * 40 }
  useModel(g, ingenuityUrl, { size: 1.11, axis: 'z' }, (m) => { // NASA Ingenuity, true size; its two rotors turn about their local x
    const [a, b] = ['rotors_01', 'rotors_02'].map((n) => m.getObjectByName(n))
    if (a && b) g.userData.spin = (dt) => { a.rotateX(dt * 40); b.rotateX(-dt * 40) }
  })
  return g
}

// A round map icon that keeps its size on screen however far away it is, so small real-size things stay findable.
export function icon(color, { ring = '#ffffff', size = 0.03, label = '' } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  x.beginPath(); x.arc(32, 32, 22, 0, 7); x.fillStyle = color; x.fill()
  x.lineWidth = 6; x.strokeStyle = ring; x.stroke()
  if (label) { x.fillStyle = '#111'; x.font = '700 26px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 32, 34) }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }))
  s.scale.setScalar(size)
  s.renderOrder = 10
  return s
}

// Sky dome: pale dusty horizon to a darker butterscotch overhead (Mars skies are brightest near the horizon).
export function makeSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir; void main(){ float h = clamp(vDir.y, 0.0, 1.0);
      vec3 col = mix(vec3(0.86, 0.72, 0.56), vec3(0.55, 0.40, 0.30), pow(h, 0.55));
      gl_FragColor = vec4(mix(vec3(0.80, 0.66, 0.52), col, smoothstep(-0.05, 0.02, vDir.y)), 1.0); }`,
  }))
}

// Scale bar and north arrow (HTML, bottom left). update(camera, controls, viewportHeightPx) each frame.
export function mapFurniture() {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(min(38vmin, 260px) + 44px);z-index:5;display:flex;gap:10px;align-items:flex-end;font:600 11px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none'
  el.innerHTML = `<div id="north" style="width:26px;height:26px;display:grid;place-items:center;transition:transform .1s"><svg width="22" height="26" viewBox="0 0 22 26"><path d="M11 1 L19 22 L11 17 L3 22 Z" fill="#fff" stroke="#000" stroke-opacity=".5"/><text x="11" y="15" text-anchor="middle" font-size="8" font-weight="700" fill="#000">N</text></svg></div>
    <div><div id="barLabel"></div><div id="bar" style="height:6px;border:2px solid #fff;border-top:0;box-shadow:0 1px 3px #0008"></div><div style="font-weight:500;opacity:.85">Vertical scale 1:1</div></div>`
  el.id = 'furniture'
  document.body.append(el)
  const bar = el.querySelector('#bar'), label = el.querySelector('#barLabel'), north = el.querySelector('#north')
  return {
    el,
    update(camera, controls, heightPx) {
      const d = camera.position.distanceTo(controls.target)
      const mPerPx = (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / heightPx
      const want = mPerPx * 110, pow = 10 ** Math.floor(Math.log10(want))
      const nice = [1, 2, 5, 10].map((k) => k * pow).filter((v) => v <= want).at(-1) ?? pow
      bar.style.width = `${nice / mPerPx}px`
      label.textContent = nice >= 1000 ? `${nice / 1000} km` : nice >= 1 ? `${nice} m` : `${Math.round(nice * 100)} cm`
      north.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`
    },
  }
}
