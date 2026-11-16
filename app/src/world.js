// World files, docs/CONTRACTS.md §1. Synthetic for now; the real Gale slice (USGS HiRISE DTM,
// Mars Trek, AI4Mars classes) drops in through the same files.

const UNREACHABLE = 1e30 // cost_to_go uses 3e38 for "cannot get back"

// AI4Mars class order: unknown, soil, bedrock, sand, big rock.
export const CLASS_RGB = [[128, 128, 128], [194, 140, 92], [120, 92, 78], [230, 186, 110], [55, 45, 42]]

export async function loadWorld(base) {
  const meta = await fetchOk(`${base}/world.json`).then((r) => r.json())
  const n = meta.width * meta.height
  const grids = Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f)) // optical.png etc. load elsewhere
  const layers = Object.fromEntries(await Promise.all(grids.map(async ([name, file]) =>
    [name, parseLayer(file, await fetchBuffer(`${base}/${file}`), n)])))
  return { meta, layers } // keys in world.json order
}

async function fetchOk(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r
}

// Binary files ship beside a gzipped copy (vite.config.js); the host does not compress octet-stream, the browser
// unzips it natively. No copy (dev server) or no DecompressionStream: the plain file.
export async function fetchBuffer(url) {
  const gz = typeof DecompressionStream === 'function' && await fetch(`${url}.gz`).catch(() => null)
  if (gz?.ok) {
    const buf = await gz.arrayBuffer(), b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
    if (b[0] === 0x1f && b[1] === 0x8b) return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  } // not gzip (the dev server answers a missing file with index.html): the plain file
  return fetchOk(url).then((r) => r.arrayBuffer())
}

// ponytail: typed arrays use the device's byte order; every phone and PC is little-endian like the files.
export function parseLayer(file, buf, n) {
  const arr = file.endsWith('.u8') ? new Uint8Array(buf) : new Float32Array(buf)
  if (arr.length !== n) throw new Error(`${file}: ${arr.length} cells, world.json says ${n}`)
  return arr
}

// RGB per cell (row 0 north), for the minimap and the mesh's vertex colours.
export function layerRGB(name, arr) {
  const out = new Uint8Array(arr.length * 3)
  if (name === 'terrain_class') {
    arr.forEach((c, i) => out.set(CLASS_RGB[c] ?? CLASS_RGB[0], i * 3))
    return out
  }
  let lo = Infinity, hi = -Infinity
  for (const v of arr) if (v < UNREACHABLE) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
  const span = hi - lo || 1
  arr.forEach((v, i) => {
    if (v >= UNREACHABLE) return out.set([200, 30, 30], i * 3) // no way home from here
    const t = (v - lo) / span // dark low, pale high
    if (name === 'belief') { // fixed scale: 0 grey .. 10% or more red (found rocks are 1), so contrast survives scouting
      const u = Math.min(1, v / 0.1)
      return out.set([60 + 195 * u, 55 - 25 * u, 60 - 30 * u], i * 3)
    }
    out.set([30 + 225 * t, 20 + 200 * t, 40 + 110 * t], i * 3)
  })
  return out
}

// "Mission · instrument · date" for a layer; world.json sources may hold a string or an object per layer.
export function sourceLabel(meta, name) {
  const s = meta.sources?.[name] ?? ''
  return typeof s === 'string' ? s : [s.mission, s.instrument, s.date].filter(Boolean).join(' · ')
}
