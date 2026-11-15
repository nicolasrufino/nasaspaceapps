// Real imagery on the terrain (rescope ticket F2, docs/SPEC.md pillar A1).
// The image is NASA MRO HiRISE colour (USGS MSL Gale LRGB 25 cm mosaic; credit NASA/JPL-Caltech/University of Arizona),
// from the detail tiles in world.json `detail_tiles` (data/pipeline/make_tiles.py). It is drawn into one 2048 px
// canvas (1 m per pixel over the 2048 m box) and draped on the 8 m mesh. Visual only: no route maths reads it.
import * as THREE from 'three'

const SIZE = 2048

// The material: imagery times the vertex colour (ring dimming, found rocks) in the Imagery view; in any other view
// the layer colour is laid over the image's brightness, so the ground detail still shows through.
export function terrainMaterial() {
  const uniforms = { uOverlay: { value: 1 }, uHasMap: { value: 0 } }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uOverlay;\nuniform float uHasMap;')
      .replace('#include <color_fragment>', `
        vec3 vc = pow(vColor.rgb, vec3(2.2)); // layer colours are sRGB bytes
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 over = vc * mix(1.0, 0.35 + 2.2 * lum, uHasMap);
        diffuseColor.rgb = mix(diffuseColor.rgb * vc, over, uOverlay);`)
  }
  mat.userData.uniforms = uniforms
  return mat
}

// UVs so the box image lines up with the mesh: app position = box metres + app_offset_m (cell centres at x * cs).
export function setImageryUVs(geo, meta, boxM = SIZE, offsetM = -4) {
  const uv = geo.attributes.uv, W = meta.width, cs = meta.cell_size_m
  for (let i = 0; i < uv.count; i++) {
    const x = i % W, y = (i - x) / W
    uv.setXY(i, (x * cs - offsetM) / boxM, 1 - (y * cs - offsetM) / boxM)
  }
  uv.needsUpdate = true
}

// Load the imagery: one overview image if world.json names it (ticket F3), else stitch the tiles, nearest the base first.
// Calls onUpdate(canvas) as it fills in. Returns { texture, canvas } or null when the world has no detail tiles.
export async function loadImagery(meta, renderer, onUpdate) {
  const url = meta.detail_tiles?.url
  if (!url) return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#8a6a55'
  ctx.fillRect(0, 0, SIZE, SIZE)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const image = (src) => new Promise((ok, fail) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = fail
    im.src = src
  })
  const done = () => { texture.needsUpdate = true; onUpdate?.(canvas) }

  if (meta.detail_tiles.overview) {
    image(meta.detail_tiles.overview).then((im) => { ctx.drawImage(im, 0, 0, SIZE, SIZE); done() }).catch(() => {})
    return { texture, canvas }
  }
  const manifest = await fetch(url).then((r) => r.json())
  const root = url.slice(0, url.lastIndexOf('/') + 1)
  const n = manifest.tiles, px = SIZE / n
  const [bx, by] = meta.base_cell.map((c) => (c * meta.cell_size_m - manifest.app_offset_m) / manifest.tile_m)
  const order = []
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) order.push([ty, tx])
  order.sort((a, b) => Math.hypot(a[1] + 0.5 - bx, a[0] + 0.5 - by) - Math.hypot(b[1] + 0.5 - bx, b[0] + 0.5 - by))
  let next = 0
  const worker = async () => {
    while (next < order.length) {
      const [ty, tx] = order[next++]
      try {
        const im = await image(root + manifest.images.replace('{ty}', ty).replace('{tx}', tx))
        ctx.drawImage(im, tx * px, ty * px, px, px)
        done()
      } catch { /* a missing tile keeps the base colour */ }
    }
  }
  Promise.all(Array.from({ length: 6 }, worker)) // ponytail: 64 tile downloads until the single overview image exists (F3)
  return { texture, canvas }
}

// The imagery at one colour per cell (for the minimap), from the canvas.
export function imageryCells(canvas, W, H) {
  const small = document.createElement('canvas')
  small.width = W
  small.height = H
  const c = small.getContext('2d', { willReadFrequently: true })
  c.drawImage(canvas, 0, 0, W, H) // ponytail: ignores the 4 m half-cell offset; under one minimap pixel
  const d = c.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 3)
  for (let i = 0; i < W * H; i++) out.set([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], i * 3)
  return out
}
