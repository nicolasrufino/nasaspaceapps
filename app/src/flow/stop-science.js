// The Visit step (issue #167, flag stop_science; off with ?off=stop_science). When the walk preview reaches a stop,
// it pauses and the rail shows what the crew does there: a task list with times, a 30-minute time bar, and the real
// Curiosity reading at that spot for each task. Readings: data/worlds/gale/stop_science.json (data/pipeline/stop_science.py):
// MSL ChemCam/APXS, DAN, REMS (NASA PDS); dose = RAD mean × sky view (an estimate). Rover photos: stops.json (NASA/JPL-Caltech/MSSS).
// Nothing here touches the energy or the route: the log goes on app.scienceLog as [{ target_id, tasks_done, minutes, dose_ugy }].

import { stopCheck } from './goal.js'

export const STOP_MIN = 30 // 2.5 h of stop time ÷ 5 stops: the budget's own planning assumption
// Which check of the goal each Curiosity stop serves, as a kind (goal.js has the words; issue #166).
export const SERVES = { nevado_sajama: 'ridge', valle_de_la_luna: 'hollow', overlook: 'pattern', ridge_top: 'pattern', altadena: 'edge' }
export const RIDGE = 'nevado_sajama', HOLLOW = 'valle_de_la_luna'
export const TASKS = [
  { id: 'look', title: 'Look around', who: 'crew, eyes and camera', min: 3 },
  { id: 'closeup', title: 'Close-up of the feature', who: 'crew, hand camera', min: 4 },
  { id: 'chem', title: "Read the rock's chemistry", who: 'crew, contact instrument', min: 8 },
  { id: 'water', title: 'Water in the ground', who: 'rover, neutron detector', min: 5 },
  { id: 'weather', title: 'Weather and radiation', who: 'suit, automatic', min: 0 },
  { id: 'sample', title: 'Take a sample', who: 'crew', min: 8 },
]
const SUB = { SiO2: 'SiO₂', TiO2: 'TiO₂', Al2O3: 'Al₂O₃', FeOT: 'FeO (total)', MgO: 'MgO', CaO: 'CaO', Na2O: 'Na₂O', K2O: 'K₂O', MnO: 'MnO' }
export const oxide = (k) => SUB[k] ?? k

// The goal's three checks (issue #166) and what in the log answers each. Nodules stay open: NASA "can't quite explain
// yet why the nodules appear where they do", and a walk does not change that.
export function goalChecks(log) {
  const did = (id, task) => log.some((e) => e.target_id === id && e.tasks_done.includes(task))
  const closeAt = (kinds) => log.some((e) => kinds.includes(SERVES[e.target_id]) && e.tasks_done.includes('closeup'))
  return [
    { title: 'Ridge against hollow: is the rock different?', answered: did(RIDGE, 'chem') && did(HOLLOW, 'chem'), how: 'chemistry read on both sides' },
    { title: 'Fractures: are the dark lines fractures?', answered: closeAt(['ridge', 'pattern']), how: 'close-up on a ridge or the boxwork pattern' },
    { title: 'Nodules: why do they appear where they do?', answered: false, how: 'still open for NASA too' },
  ]
}

export const enabled = () => !(new URLSearchParams(location.search).get('off') ?? '').split(',').includes('stop_science')
const json = (f) => fetch(`${import.meta.env.BASE_URL}gale/${f}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
export const load = () => json('stop_science.json')

// Minutes and dose of one stop's log entry: dose = dose_ugy_per_hour × minutes ÷ 60.
export function tally(done, rec) {
  const minutes = TASKS.filter((t) => done.includes(t.id)).reduce((a, t) => a + t.min, 0)
  return { minutes, dose_ugy: rec ? +((rec.dose_ugy_per_hour * minutes) / 60).toFixed(2) : 0 }
}

// The step index at which the route reaches each of its stops, in walking order.
export function stopSteps(cells, order, stops) {
  const out = []
  let from = 0
  for (const id of order) {
    const s = stops.find((x) => x.id === id)
    if (!s) continue
    const i = cells.findIndex(([x, y], j) => j >= from && x === s.cell[0] && y === s.cell[1])
    if (i < 0) continue
    out.push({ id, k: i, stop: s })
    from = i
  }
  return out
}

const CSS = `
.ss-task { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid var(--panel2); }
.ss-task button { all: unset; cursor: pointer; flex: none; width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--mute); display: grid; place-items: center; font-weight: 700; font-size: 13px; }
.ss-task button[aria-pressed=true] { background: var(--stop); border-color: var(--stop); color: var(--ink); }
.ss-task .t { flex: 1; min-width: 0; } .ss-task .t small { display: block; color: var(--mute); font-size: 12px; }
.ss-task .t .r { display: block; margin-top: 4px; font-size: 13px; } .ss-task .t .r:empty { display: none; }
.ss-task .m { color: var(--mute); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ss-photo { width: 100%; border-radius: 8px; display: block; margin-top: 6px; }
.ss-warn { color: var(--hazard); font-size: 12px; }
.ss-card table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.ss-card th, .ss-card td { text-align: right; padding: 3px 0; border-top: 1px solid var(--panel2); } .ss-card th:first-child, .ss-card td:first-child { text-align: left; }
.ss-card th { color: var(--mute); font-weight: 600; font-size: 12px; }
`

// ui, app: the flow's. data: stop_science.json. onDone(): the crew carries on walking.
export function createStopScience(ui, app, data) {
  if (!document.getElementById('ss-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'ss-style', textContent: CSS }))
  const landforms = Object.fromEntries((data.landform_key ?? '').split(', ').map((s) => s.split(' ')))
  const recOf = (id) => data.stops.find((s) => s.target_id === id)
  const el = ui.h('div', 'f-sec')
  const log = (app.scienceLog = [])
  let yieldData = null // S6's numbers (ml/pitch_metrics/science_yield.py, world-side copy); the lines hide without it
  json('science_yield.json').then((y) => (yieldData = y))
  let samples = 0, lastK = 0, steps = [], seen = new Set(), comparedShown = false, resume = null
  const txt = (tag, text, cls = '') => Object.assign(ui.h(tag, cls), { textContent: text })

  function reset() {
    steps = stopSteps(app.route().cells, app.route().stops, app.stops())
    log.length = 0
    samples = 0; lastK = 0; seen = new Set(); comparedShown = false
    resume = null
    el.replaceChildren()
  }

  // What a task shows once done. Every number is read from the record.
  function result(id, rec, stop) {
    const c = rec?.chem, n = rec?.neutron, w = rec?.weather
    switch (id) {
      case 'look': {
        const box = ui.h('span')
        box.append(`Landform here: ${landforms[rec?.landform] ?? 'not mapped'}.`)
        if (stop.photo) {
          const img = Object.assign(ui.h('img', 'ss-photo'), { src: stop.photo.image_url, alt: stop.photo.caption ?? stop.name, loading: 'lazy' })
          box.append(img, txt('small', [stop.photo.caption, stop.photo.credit].filter(Boolean).join(' · ')))
        }
        return box
      }
      case 'closeup': return stopCheck(stop.id) ? `Serves the check: ${stopCheck(stop.id)}.` : 'Close-up taken.'
      case 'chem': return c
        ? `SiO₂ ${c.oxides_wt_pct.SiO2} · MgO ${c.oxides_wt_pct.MgO} · CaO ${c.oxides_wt_pct.CaO} wt%. Curiosity's ${c.instrument} measured this here on sol ${c.sol}${c.metres_away ? `, ${c.metres_away} m away` : ''}.`
        : 'No Curiosity chemistry within 60 m of this stop.'
      case 'water': return n ? `${n.thermal_epithermal_ratio} thermal/epithermal: relative hydrogen, ${n.instrument}, sol ${n.sol}.` : 'No neutron reading for this stop.'
      case 'weather': return w ? `${w.min_temp_c} to ${w.max_temp_c} °C, ${w.pressure_pa} Pa (${w.instrument}, sol ${w.sol}).` : 'No weather reading for this stop.'
      case 'sample': return `Samples carried: ${samples}.`
    }
  }

  // Ridge against hollow, once both have had their chemistry read.
  function compareCard() {
    const a = log.find((e) => e.target_id === RIDGE), b = log.find((e) => e.target_id === HOLLOW)
    if (!a?.tasks_done.includes('chem') || !b?.tasks_done.includes('chem')) return null
    const ca = recOf(RIDGE)?.chem, cb = recOf(HOLLOW)?.chem
    if (!ca || !cb) return null
    const name = (id) => app.stops().find((s) => s.id === id)?.name ?? id
    const sec = ui.section('Ridge against hollow')
    sec.classList.add('ss-card')
    const t = ui.h('table')
    const hr = ui.h('tr'); hr.append(txt('th', 'wt%'), txt("th", name(RIDGE)), txt("th", name(HOLLOW))); t.append(hr)
    for (const k of Object.keys(ca.oxides_wt_pct)) {
      const r = ui.h('tr'); r.append(txt('td', oxide(k)), txt('td', ca.oxides_wt_pct[k]), txt('td', cb.oxides_wt_pct[k] ?? '–')); t.append(r)
    }
    sec.append(t, txt('p', `${ca.instrument} sol ${ca.sol} against ${cb.instrument} sol ${cb.sol}. Readings are Curiosity's real measurements at these spots, standing in for yours.`, 'dim'))
    return sec
  }

  function open(entry, onDone) {
    resume = onDone
    const { stop } = entry, rec = recOf(stop.id)
    const row = { target_id: stop.id, tasks_done: [], minutes: 0, dose_ugy: 0 }
    log.push(row)
    const sec = ui.section(`At ${stop.name}`, true)
    sec.append(txt('p', "Readings are Curiosity's real measurements at this spot, standing in for yours.", 'dim'))
    const time = txt('p', ''), bar = ui.bar(), warn = txt('p', '', 'ss-warn')
    const list = ui.h('div', 'f-list')
    const redraw = () => {
      Object.assign(row, tally(row.tasks_done, rec))
      time.textContent = `${row.minutes} of ${STOP_MIN} min at this stop (planning assumption) · dose ${row.dose_ugy} µGy`
      bar.set(row.minutes / STOP_MIN)
      warn.textContent = row.minutes > STOP_MIN ? `Over the ${STOP_MIN} minutes planned for this stop.` : ''
    }
    for (const t of TASKS) {
      const r = ui.h('div', 'ss-task'), box = ui.h('button'), body = ui.h('span', 't'), res = ui.h('span', 'r')
      box.type = 'button'; box.setAttribute('aria-pressed', 'false'); box.setAttribute('aria-label', t.title)
      body.append(t.title, txt('small', t.who), res)
      box.onclick = () => {
        if (row.tasks_done.includes(t.id)) return
        row.tasks_done.push(t.id)
        if (t.id === 'sample') samples++
        box.setAttribute('aria-pressed', 'true'); box.textContent = '✓'
        res.replaceChildren(result(t.id, rec, stop))
        redraw()
        const card = !comparedShown && compareCard()
        if (card) { comparedShown = true; el.append(card) }
      }
      r.append(box, body, txt('span', `${t.min} min`, 'm'))
      list.append(r)
    }
    const go = ui.button('Carry on walking', proceed, true)
    sec.append(time, bar.el, warn, list, go)
    el.replaceChildren(sec, ...[...el.children].filter((c) => c.classList.contains('ss-card')))
    redraw()
    el.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  function proceed() {
    if (!resume) return
    const onDone = resume
    resume = null
    el.replaceChildren(...[...el.children].filter((c) => c.classList.contains('ss-card')))
    onDone()
  }

  // The Science log, shown when the walk is back at the habitat: per stop, then the goal's three checks.
  function finish() {
    if (el.querySelector('.ss-log')) return
    const sec = ui.section('Science log', true)
    sec.classList.add('ss-log')
    const dose = +log.reduce((a, e) => a + e.dose_ugy, 0).toFixed(2)
    sec.append(ui.stats([['stops worked', log.filter((e) => e.tasks_done.length).length], ['samples carried', samples, 'stop'], ['µGy at the stops', dose]]).el)
    sec.append(txt('p', `This walk: ${log.reduce((n, e) => n + e.tasks_done.length, 0)} tasks completed.`))
    const list = ui.h('div', 'f-list')
    for (const e of log) {
      const stop = app.stops().find((s) => s.id === e.target_id), c = recOf(e.target_id)?.chem
      const chem = e.tasks_done.includes('chem') && c ? ` · SiO₂ ${c.oxides_wt_pct.SiO2}, MgO ${c.oxides_wt_pct.MgO}, CaO ${c.oxides_wt_pct.CaO} wt% (${c.instrument}, sol ${c.sol})` : ''
      const tasks = TASKS.filter((t) => e.tasks_done.includes(t.id)).map((t) => t.title.toLowerCase()).join(', ') || 'nothing done'
      list.append(ui.item({ title: stop?.name ?? e.target_id, sub: `${e.minutes} min · ${e.dose_ugy} µGy · ${e.tasks_done.includes('sample') ? '1 sample' : 'no sample'} · ${tasks}${chem}` }))
    }
    const goals = ui.section('The goal: did groundwater last here?')
    for (const g of goalChecks(log)) goals.append(ui.item({ title: `${g.answered ? '✓ Answered' : '○ Still open'}: ${g.title}`, sub: g.how }))
    sec.append(list, txt('p', 'Dose at the stops: RAD mean × sky view at each stop (an estimate) × minutes there.', 'dim'))
    const y = yieldData
    // S6 describes a fixed reference route. Even identical stops can produce a different path;
    // never add its walking dose to this walk's stop dose or present its capacity as tasks done.
    if (y?.walk && y?.stay) sec.append(txt('p', `Reference scenario: ${y.walk.stops} stops × ${y.walk.visit_tasks_per_stop} tasks = ${y.walk.measurements_per_walk} tasks per walk, with all tasks completed. A ${y.stay.stay_sols}-sol stay: at most ${y.stay.walks_max} walks, ${y.stay.stops_max} stops, ${y.stay.measurements_max} tasks (our arithmetic, ${y.stay.sols_per_walk} sols per walk). These are planning assumptions, not the result of this walk.`, 'dim'))
    if (y?.dose?.walk_dose_ugy != null && y.walk?.route_m != null) sec.append(txt('p', `Reference route (${y.walk.route_m} m): walking dose ${y.dose.walk_dose_ugy} µGy (${y.dose.walk_hours} h at ${y.dose.mean_dose_rate_ugy_per_h} µGy/h, an estimate). Walking only; stops excluded. This is not the dose of your chosen route.`, 'dim'))
    el.replaceChildren(sec, goals, ...[...el.children].filter((c) => c.classList.contains('ss-card')))
  }

  // Called by the preview on every tick with the walker's step. Returns true when it stopped the walk at a stop.
  // Only a walk that moves forward a little opens a stop; a jump along the height strip does not.
  function at(k, onDone) {
    if (k < lastK && k === 0) reset()
    const prev = lastK
    lastK = k
    if (k - prev <= 0 || k - prev > 12) return null
    const hit = steps.find((s) => !seen.has(s.id) && s.k > prev && s.k <= k)
    if (!hit) return null
    seen.add(hit.id)
    open(hit, onDone)
    return hit
  }

  reset()
  return { el, at, reset, finish, log, samples: () => samples, active: () => resume !== null, proceed }
}
