// Detail tiles (rescope ticket F7, docs/SPEC.md pillar A2): 1 m terrain and 25 cm HiRISE imagery near what you look at.
// Data: USGS MSL Gale merged DEM 1 m (MRO HiRISE stereo) and USGS MSL Gale HiRISE LRGB 25 cm mosaic
// (NASA/JPL-Caltech/University of Arizona), cut into 256 m tiles by data/pipeline/make_tiles.py and hosted on Azure Blob
// (world.json `detail_tiles`). Visual only: routes, energy and the ring stay on the 8 m grid (docs/CONTRACTS.md).
import * as THREE from 'three'

const SKIRT_M = 6 // ponytail: edges drop 6 m so no gap shows against the 8 m mesh; proper LOD stitching if it ever matters
export const MAX_HOLES = 9

// Geometry for one tile in app coordinates: sample (r, c) sits at box metres (tx*T + c + 0.5, ty*T + r + 0.5),
// and app position = box metres + app_offset_m (make_tiles.py).
function tileGeometry(heights, n, x0, z0, res, base) {
  const ring = 4 * (n - 1), count = n * n + ring
  const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c
    pos.set([x0 + c * res, base + heights[i] / 100, z0 + r * res], i * 3)
    uv.set([(c + 0.5) / (n - 1), 1 - (r + 0.5) / (n - 1)], i * 2)
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6 + ring * 6)
  let k = 0
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const a = r * n + c, b = a + 1, d = a + n, e = d + 1
    idx.set([a, d, b, b, d, e], k); k += 6
  }
  // Skirt: walk the border once, clockwise from the north-west corner; each border vertex gets a lowered twin.
  const border = []
  for (let c = 0; c < n - 1; c++) border.push(c)
  for (let r = 0; r < n - 1; r++) border.push(r * n + n - 1)
  for (let c = n - 1; c > 0; c--) border.push((n - 1) * n + c)
  for (let r = n - 1; r > 0; r--) border.push(r * n)
  border.forEach((v, j) => {
    const s = n * n + j
    pos.set([pos[v * 3], pos[v * 3 + 1] - SKIRT_M, pos[v * 3 + 2]], s * 3)
    uv.set([uv[v * 2], uv[v * 2 + 1]], s * 2)
  })
  border.forEach((v, j) => {
    const v2 = border[(j + 1) % ring], s = n * n + j, s2 = n * n + ((j + 1) % ring)
    idx.set([v, v2, s, v2, s2, s], k); k += 6
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeVertexNormals()
  return geo
}

// Tile material: the tile's own image, tinted by the shared per-cell tint texture (ring dimming, found rocks, the
// current layer), exactly as the 8 m mesh is tinted by its vertex colours.
function tileMaterial(map, shared) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, side: THREE.DoubleSide }) // skirts face outwards
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uCells;\nvarying vec2 vTintUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTintUv = (position.xz / uCells.x + 0.5) / uCells.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uTint;\nuniform float uOverlay;\nvarying vec2 vTintUv;')
      .replace('#include <color_fragment>', `
        vec3 vc = pow(texture2D(uTint, vTintUv).rgb, vec3(2.2));
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb * vc, vc * (0.35 + 2.2 * lum), uOverlay);`)
  }
  return mat
}

// Keeps the tiles near the focus points loaded, and the rest released.
//   shared: { uTint, uOverlay, uCells } uniforms; onChange(): called when the set of live tiles changes.
export async function detailTiles(meta, scene, renderer, shared, onChange, { maxTiles = 9, radiusM = 330 } = {}) {
  const url = meta.detail_tiles?.url
  if (!url) return null
  const m = await fetch(url).then((r) => r.json())
  const root = url.slice(0, url.lastIndexOf('/') + 1)
  const T = m.tile_m, n = m.height_px, res = m.height_res_m, off = m.app_offset_m
  const file = (pattern, ty, tx) => root + pattern.replace('{ty}', ty).replace('{tx}', tx)
  const live = new Map() // "ty_tx" -> { mesh, heights, x0, z0 } or 'loading'
  const loader = new THREE.TextureLoader().setCrossOrigin('anonymous')
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())

  async function load(ty, tx) {
    const key = `${ty}_${tx}`
    live.set(key, 'loading')
    try {
      const [buf, tex] = await Promise.all([
        fetch(file(m.heights, ty, tx)).then((r) => r.arrayBuffer()),
        loader.loadAsync(file(m.images, ty, tx)),
      ])
      if (live.get(key) !== 'loading') return tex.dispose() // dropped while loading
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = aniso
      const heights = new Uint16Array(buf) // ponytail: little-endian hosts only, like world.js
      const x0 = tx * T + 0.5 * res + off, z0 = ty * T + 0.5 * res + off
      const mesh = new THREE.Mesh(tileGeometry(heights, n, x0, z0, res, m.height_base_m), tileMaterial(tex, shared))
      scene.add(mesh)
      live.set(key, { mesh, heights, x0, z0 })
      onChange()
    } catch { live.delete(key) }
  }
  function drop(key) {
    const t = live.get(key)
    live.delete(key)
    if (t && t !== 'loading') {
      scene.remove(t.mesh)
      t.mesh.geometry.dispose()
      t.mesh.material.map.dispose()
      t.mesh.material.dispose()
      onChange()
    }
  }

  return {
    // focus: [[x, z], ...] in app metres. Load the nearest tiles within radiusM of any focus; release far ones.
    update(focus) {
      const want = []
      for (let ty = 0; ty < m.tiles; ty++) for (let tx = 0; tx < m.tiles; tx++) {
        const cx = (tx + 0.5) * T + off, cz = (ty + 0.5) * T + off
        const d = Math.min(...focus.map(([x, z]) => Math.hypot(Math.max(Math.abs(x - cx) - T / 2, 0), Math.max(Math.abs(z - cz) - T / 2, 0))))
        if (d <= radiusM) want.push([d, `${ty}_${tx}`, ty, tx])
      }
      want.sort((a, b) => a[0] - b[0])
      const keep = new Set(want.slice(0, maxTiles).map((w) => w[1]))
      for (const key of [...live.keys()]) if (!keep.has(key)) drop(key)
      let starting = [...live.values()].filter((t) => t === 'loading').length
      for (const [, key, ty, tx] of want.slice(0, maxTiles)) {
        if (live.has(key) || starting >= 3) continue
        starting++
        load(ty, tx)
      }
    },
    // Rectangles [x0, z0, x1, z1] covered by loaded tiles, so the 8 m mesh can be cut away under them.
    holes() {
      return [...live.values()].filter((t) => t !== 'loading').map((t) => [t.x0, t.z0, t.x0 + (n - 1) * res, t.z0 + (n - 1) * res])
    },
    // Height of the 1 m surface at app (x, z), or null where no tile is loaded.
    heightAt(x, z) {
      for (const t of live.values()) {
        if (t === 'loading') continue
        const c = (x - t.x0) / res, r = (z - t.z0) / res
        if (c < 0 || r < 0 || c > n - 1 || r > n - 1) continue
        const c0 = Math.min(n - 2, Math.floor(c)), r0 = Math.min(n - 2, Math.floor(r)), fc = c - c0, fr = r - r0
        const h = (i, j) => t.heights[(r0 + i) * n + c0 + j]
        return m.height_base_m + ((h(0, 0) * (1 - fc) + h(0, 1) * fc) * (1 - fr) + (h(1, 0) * (1 - fc) + h(1, 1) * fc) * fr) / 100
      }
      return null
    },
    count: () => [...live.values()].filter((t) => t !== 'loading').length,
  }
}
