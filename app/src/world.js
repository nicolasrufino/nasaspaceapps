// World files, docs/CONTRACTS.md §1. Synthetic for now; the real Gale slice (USGS HiRISE DTM,
// Mars Trek, AI4Mars classes) drops in through the same files.

const UNREACHABLE = 1e30 // cost_to_go uses 3e38 for "cannot get back"

// AI4Mars class order: unknown, soil, bedrock, sand, big rock.
export const CLASS_RGB = [[128, 128, 128], [194, 140, 92], [120, 92, 78], [230, 186, 110], [55, 45, 42]]

export async function loadWorld(base) {
  const meta = await fetchOk(`${base}/world.json`).then((r) => r.json())
  const n = meta.width * meta.height
  const layers = Object.fromEntries(await Promise.all(Object.entries(meta.files).map(async ([name, file]) =>
    [name, parseLayer(file, await fetchOk(`${base}/${file}`).then((r) => r.arrayBuffer()), n)])))
  return { meta, layers } // keys in world.json order
}

async function fetchOk(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r
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
    out.set([30 + 225 * t, 20 + 200 * t, 40 + 110 * t], i * 3)
  })
  return out
}
