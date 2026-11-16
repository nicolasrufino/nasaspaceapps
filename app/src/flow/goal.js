// Stage 1's science goals (issue #166): which check each Curiosity stop serves, and the boxwork sites the map ranks.
// The goal's checks come from NASA's boxwork article: https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/

// Which check each of Curiosity's stops serves, from where it drilled or looked (targets.json, NASA blog links there).
// ponytail: keyed by stop id, not stop_science.json landform: our 1 m landform map puts Nevado Sajama (ridge drill) on "slope".
const STOP_CHECK = { nevado_sajama: 'Ridge against hollow: the ridge', valle_de_la_luna: 'Ridge against hollow: the hollow', overlook: 'The pattern', ridge_top: 'The pattern', altadena: 'Edge of the boxwork unit' }
export const stopCheck = (id) => STOP_CHECK[id]

// Sites from S5's boxwork finder (candidates.json: [{ id, name, cell, score, why, curiosity_visited }]), or [] when absent.
export const loadCandidates = () => fetch(`${import.meta.env.BASE_URL}${new URLSearchParams(location.search).get('world') ?? 'gale'}/candidates.json`)
  .then((r) => (r.ok ? r.json() : [])).then((c) => (Array.isArray(c) ? c.filter((s) => Array.isArray(s.cell)) : [])).catch(() => [])
