// Stage 1's science goal (issue #166, flag science_goal, on by default; ?off=science_goal turns it off).
// Every line is from NASA's boxwork article, linked beside each check:
const NASA = 'https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/'

export const scienceGoalOn = (search = location.search) => !(new URLSearchParams(search).get('off') ?? '').split(',').includes('science_goal')

const CHECKS = [
  ['Ridge against hollow', 'Is the rock different? Curiosity’s drill found clay in the ridge and carbonate in the hollow: only drilled samples showed it.'],
  ['Fractures', 'Dark lines across the ridges, seen from orbit, were confirmed as fractures only when Curiosity looked up close.'],
  ['Nodules', 'Found on ridge walls and in hollows, not by the fractures. NASA: “We can’t quite explain yet why the nodules appear where they do.” The open question.'],
]

// Which check each of Curiosity's stops serves, from where it drilled or looked (targets.json, NASA blog links there).
// ponytail: keyed by stop id, not stop_science.json landform: our 1 m landform map puts Nevado Sajama (ridge drill) on "slope".
const STOP_CHECK = { nevado_sajama: 'Ridge against hollow: the ridge', valle_de_la_luna: 'Ridge against hollow: the hollow', overlook: 'The pattern', ridge_top: 'The pattern', altadena: 'Edge of the boxwork unit' }
export const stopCheck = (id) => STOP_CHECK[id]

export function goalCard(ui) {
  const sec = ui.section('Science goal')
  const title = Object.assign(ui.h('h2'), { textContent: 'Boxwork: did groundwater last here?' })
  const what = Object.assign(ui.h('p', 'dim'), { textContent: 'Boxwork is low ridges, 1 to 2 m tall, with sandy hollows between: a spiderweb from orbit. It suggests groundwater flowed here later than expected. Three things the crew will check:' })
  sec.append(title, what, ...CHECKS.map(([name, text]) => {
    const row = ui.h('div', 'f-item'), t = ui.h('span', 't'), s = ui.h('small'), a = ui.h('a')
    t.textContent = name
    s.textContent = `${text} `
    Object.assign(a, { href: NASA, target: '_blank', rel: 'noopener', textContent: 'NASA ↗' })
    a.style.color = 'inherit'
    s.append(a); t.append(s); row.append(t)
    return row
  }))
  return sec
}

// Sites from S5's boxwork finder (candidates.json: [{ id, name, cell, score, why, curiosity_visited }]), or [] when absent.
export const loadCandidates = () => fetch(`${import.meta.env.BASE_URL}${new URLSearchParams(location.search).get('world') ?? 'gale'}/candidates.json`)
  .then((r) => (r.ok ? r.json() : [])).then((c) => (Array.isArray(c) ? c.filter((s) => Array.isArray(s.cell)) : [])).catch(() => [])
