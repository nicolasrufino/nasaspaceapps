// What the scout carries: NASA's SkyFall payload (Mission Information Package, Sept 2026, sections II and IV),
// and what stands in for each instrument in our simulation. Every value on screen is read from the world's
// layers at run time; a row whose layer is missing is left out. Kill switch: ?off=scout_payload (issue #169).
export const SKYFALL_URL = 'https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf'

// Our strip width check: the colour cameras' 106° horizontal view (NASA) at a flying height NASA does not give.
export const ASSUMED_HEIGHT_M = 10 // our assumption, not NASA's
export const footprintM = (heightM = ASSUMED_HEIGHT_M, fovDeg = 106) => 2 * heightM * Math.tan((fovDeg / 2) * (Math.PI / 180))

export const payloadOff = (search = globalThis.location?.search ?? '') =>
  new URLSearchParams(search).getAll('off').flatMap((v) => v.split(',')).includes('scout_payload')

// The six rows. `needs` names the layer (or file) the stand-in reads; the row is hidden when it is missing.
export const INSTRUMENTS = [
  { name: 'Two colour cameras, 13 MP', kind: 'optical, topographic', nasa: 'cm-scale orthophotos and elevation maps',
    stand: 'the 25 cm HiRISE image and 1 m terrain uncovered in the strip', sim: true, needs: 'height' },
  { name: 'Two near-infrared cameras', kind: 'spectral', nasa: '"some information on mineralogy or chemistry"',
    stand: 'CRISM hydration in the strip: orbit data at 18 m, not the helicopter\'s', sim: true, needs: 'science' },
  { name: 'Ground-penetrating radar', kind: 'geophysical', nasa: 'about 3–5 m below the surface',
    stand: 'nothing', sim: false },
  { name: 'Air temperature, wind from flight', kind: 'atmospheric', nasa: 'wind to within about 5 m/s',
    stand: 'Curiosity REMS air temperature range; wind is not simulated', sim: true, needs: 'weather' },
  { name: 'Dosimeter', kind: 'radiation', nasa: 'a 3D map of incident radiation',
    stand: 'mean dose over the strip (Curiosity RAD × sky view, estimate)', sim: true, needs: 'dose_rate' },
  { name: 'Two navigation cameras', kind: 'hazards', nasa: 'textured ground "indicative of rocks"',
    stand: 'the stored rock layer (rocks_fine)', sim: true, needs: 'rocks_fine' },
]

// REMS range from weather.json ({ sols: [{ min_temp_c, max_temp_c }] }), or null.
export function remsRange(weather) {
  const sols = weather?.sols ?? []
  const lo = sols.map((s) => s.min_temp_c).filter(Number.isFinite), hi = sols.map((s) => s.max_temp_c).filter(Number.isFinite)
  return lo.length && hi.length ? { min: Math.min(...lo), max: Math.max(...hi), sols: sols.length } : null
}

// What one flight recorded: the cells it saw for the first time (`fresh`, indices), read against the layers.
// landform: 2 ridge, 3 hollow; dose_rate is in µGy/h (data/pipeline/add_d6_layers.py). Null when a layer is missing.
export function stripRecord(layers, fresh, cs) {
  const n = fresh.length
  const share = (arr, v) => (arr && n ? fresh.filter((i) => arr[i] === v).length / n : null)
  const dose = layers.dose_rate ? fresh.map((i) => layers.dose_rate[i]).filter(Number.isFinite) : []
  return {
    cells: n, area_m2: n * cs * cs,
    ridge: share(layers.landform, 2), hollow: share(layers.landform, 3),
    dose: dose.length ? dose.reduce((a, b) => a + b, 0) / dose.length : null,
    rocks: layers.rocks_fine ? fresh.filter((i) => layers.rocks_fine[i]).length : null,
  }
}
