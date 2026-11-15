// Real imagery on the terrain (rescope ticket F2, docs/SPEC.md pillar A1).
// The image is NASA MRO HiRISE colour (USGS MSL Gale LRGB 25 cm mosaic; credit NASA/JPL-Caltech/University of Arizona),
// from the detail tiles in world.json `detail_tiles` (data/pipeline/make_tiles.py). It is drawn into one 2048 px
// canvas (1 m per pixel over the 2048 m box) and draped on the 8 m mesh. Visual only: no route maths reads it.
import * as THREE from 'three'

const SIZE = 2048

// The material: imagery times the vertex colour (ring dimming, found rocks) in the Imagery view; in any other view
// the layer colour is laid over the image's brightness, so the ground detail still shows through.
// Shared by the 8 m mesh and the detail tiles (ticket A3, the discover look): ground the helicopter has not flown is
// drawn muted (mostly grey, a little darker); flown ground is full colour. The tint texture's alpha is 1 where flown.
// A bright ring on the ground marks the helicopter's scan as it passes. Needs: vec2 xz (app metres), vec2 tintUv.
export const REVEAL_GLSL = `
  float rev = max(texture2D(uTint, tintUv).a, 1.0 - uMuted);
  float grey = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(mix(vec3(grey), diffuseColor.rgb, 0.4) * 0.82, diffuseColor.rgb, rev);
  float sweep = smoothstep(3.0, 0.0, abs(distance(xz, uHeli.xy) - uHeli.z)) * step(0.01, uHeli.z);
  diffuseColor.rgb += vec3(0.15, 0.85, 1.0) * sweep * 0.9;`
export const REVEAL_UNIFORMS = 'uniform sampler2D uTint;\nuniform float uMuted;\nuniform vec3 uHeli;\nuniform vec2 uCells;\n' +
  'uniform float uContour;\nuniform float uContourBase;'

// Contour lines (ticket A7): thin brown lines every 5 m and a bolder one every 25 m of real elevation (height.f32 + the
// world's height_offset_m, so lines sit at round metres of the USGS MSL Gale DEM's datum). Widths are in screen pixels
// (fwidth), so they stay crisp at any zoom; where lines would crowd closer than a few pixels they fade out instead of
// shimmering. Shared by the 8 m mesh and the detail tiles. Needs: float hy (height in the height.f32 datum).
export const CONTOUR_GLSL = `
  if (uContour > 0.5) {
    float hAbs = hy + uContourBase;
    float f5 = hAbs / 5.0, w5 = max(fwidth(f5), 1e-5);
    float f25 = hAbs / 25.0, w25 = max(fwidth(f25), 1e-5);
    float minor = 1.0 - smoothstep(0.5, 1.3, abs(fract(f5 - 0.5) - 0.5) / w5);
    float major = 1.0 - smoothstep(0.9, 2.0, abs(fract(f25 - 0.5) - 0.5) / w25);
    minor *= 1.0 - smoothstep(0.12, 0.3, w5); // under ~4 px apart: fade
    major *= 1.0 - smoothstep(0.25, 0.5, w25);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.12, 0.05), max(minor * 0.55, major * 0.9));
  }`

export function terrainMaterial(shared = {}) {
  // uHoles: rectangles [x0, z0, x1, z1] where a 1 m detail tile is drawn instead (tiles.js); this mesh is cut away there.
  const uniforms = { uOverlay: { value: 1 }, uHasMap: { value: 0 },
    uHoles: { value: Array.from({ length: 9 }, () => new THREE.Vector4()) }, uHoleCount: { value: 0 }, ...shared }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = position.xz;\nvY = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uOverlay;\nuniform float uHasMap;\nuniform vec4 uHoles[9];\nuniform int uHoleCount;\nvarying vec2 vXZ;\nvarying float vY;\n${REVEAL_UNIFORMS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < 9; i++) {
          if (i >= uHoleCount) break;
          if (vXZ.x > uHoles[i].x && vXZ.y > uHoles[i].y && vXZ.x < uHoles[i].z && vXZ.y < uHoles[i].w) discard;
        }`)
      .replace('#include <color_fragment>', `
        vec3 vc = pow(vColor.rgb, vec3(2.2)); // layer colours are sRGB bytes
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 over = vc * mix(1.0, 0.35 + 2.2 * lum, uHasMap);
        diffuseColor.rgb = mix(diffuseColor.rgb * vc, over, uOverlay);
        vec2 xz = vXZ; vec2 tintUv = (vXZ / uCells.x + 0.5) / uCells.y;${REVEAL_GLSL}
        float hy = vY;${CONTOUR_GLSL}`)
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
