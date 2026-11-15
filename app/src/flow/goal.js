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
  sec.classList.add('f-goal')
  const what = Object.assign(ui.h('p', 'dim'), { textContent: 'Boxwork is low ridges, 1 to 2 m tall, with sandy hollows between: a spiderweb from orbit. It suggests groundwater flowed here later than expected. Three things the crew will check:' })
  const details = ui.details('Did groundwater last here?', what, ...CHECKS.map(([name, text]) => {
    const row = ui.h('div', 'f-item'), t = ui.h('span', 't'), s = ui.h('small'), a = ui.h('a')
    t.textContent = name
    s.textContent = `${text} `
    Object.assign(a, { href: NASA, target: '_blank', rel: 'noopener', textContent: 'NASA ↗' })
    a.style.color = 'inherit'
    s.append(a); t.append(s); row.append(t)
    return row
  }))
  sec.append(details)
  return sec
}

// Sites from S5's boxwork finder (candidates.json: [{ id, name, cell, score, why, curiosity_visited }]), or [] when absent.
export const loadCandidates = () => fetch(`${import.meta.env.BASE_URL}${new URLSearchParams(location.search).get('world') ?? 'gale'}/candidates.json`)
  .then((r) => (r.ok ? r.json() : [])).then((c) => (Array.isArray(c) ? c.filter((s) => Array.isArray(s.cell)) : [])).catch(() => [])

// Stage 1 "Science goals" (?off=goals returns the old stage 1): pick ONE goal, then Proceed adds its stops.
export const goalsOn = (search = location.search) => !(new URLSearchParams(search).get('off') ?? '').split(',').includes('goals')
const GW = 'https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/'
const GOALS = [
  { id: 'water', name: 'Groundwater', line: 'Where did water last on Mount Sharp?',
    more: 'Signals: hydrated minerals from orbit (MRO CRISM, 18 m pixels) and Curiosity’s neutron detector DAN (relative hydrogen along the rover’s path). JPL: water was still underground as Mars dried.', link: GW },
  { id: 'boxwork', name: 'Investigate boxwork', line: 'The ridge-and-hollow pattern, a spiderweb from orbit.',
    more: 'Low ridges 1 to 2 m tall with sandy hollows between. Curiosity drilled clay in a ridge and carbonate in a hollow; why nodules sit where they do is still open.', link: NASA },
]
export function goalsSection(ui, onProceed) {
  const sec = ui.section('Science goals')
  sec.classList.add('f-goals')
  let pick = null
  const note = ui.h('p', 'dim')
  const go = ui.button('Proceed', () => onProceed(pick, note))
  go.disabled = true
  const cards = GOALS.map((g) => {
    const card = ui.h('div', 'f-goal-card'), head = ui.h('label'), r = ui.h('input'), t = ui.h('b'), line = ui.h('small')
    Object.assign(r, { type: 'radio', name: 'science-goal', value: g.id })
    r.onchange = () => { pick = g.id; go.disabled = false; note.textContent = '' }
    t.textContent = g.name; line.textContent = g.line
    head.append(r, t, line)
    const d = ui.h('details'), s = ui.h('summary'), p = ui.h('p', 'dim'), a = ui.h('a')
    s.textContent = '+'; s.setAttribute('aria-label', `More about ${g.name}`)
    Object.assign(a, { href: g.link, target: '_blank', rel: 'noopener', textContent: 'NASA ↗' })
    p.append(`${g.more} `, a); d.append(s, p)
    card.append(head, d)
    return card
  })
  sec.append(...cards, go, note)
  return sec
}
