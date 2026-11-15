// The Visit step (issue #167, flag stop_science; off with ?off=stop_science). When the walk preview reaches a stop,
// it pauses and the rail shows what the crew does there: a task list with times, a 30-minute time bar, and the real
// Curiosity reading at that spot for each task. Readings: data/worlds/gale/stop_science.json (data/pipeline/stop_science.py):
// MSL ChemCam/APXS, DAN, REMS (NASA PDS); dose = RAD mean × sky view (an estimate). Rover photos: stops.json (NASA/JPL-Caltech/MSSS).
// Nothing here touches the energy or the route: the log goes on app.scienceLog as [{ target_id, tasks_done, minutes, dose_ugy }].

export const STOP_MIN = 30 // 2.5 h of stop time ÷ 5 stops: the budget's own planning assumption
// Which check of the goal each Curiosity stop serves (issue #166; NASA: "Curiosity rover sees Martian spiderwebs up close").
export const SERVES = { nevado_sajama: 'ridge', valle_de_la_luna: 'hollow', overlook: 'pattern', ridge_top: 'pattern', altadena: 'edge' }
const SERVES_TEXT = { ridge: 'ridge against hollow: the ridge side', hollow: 'ridge against hollow: the hollow side', pattern: 'the boxwork pattern and its fractures', edge: 'the edge of the boxwork' }
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

export const enabled = () => !(new URLSearchParams(location.search).get('off') ?? '').split(',').includes('stop_science')
export const load = () => fetch(`${import.meta.env.BASE_URL}gale/stop_science.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)

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
  let samples = 0, lastK = 0, steps = [], seen = new Set(), comparedShown = false
  const txt = (tag, text, cls = '') => Object.assign(ui.h(tag, cls), { textContent: text })

  function reset() {
    steps = stopSteps(app.route().cells, app.route().stops, app.stops())
    log.length = 0
    samples = 0; lastK = 0; seen = new Set(); comparedShown = false
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
      case 'closeup': return SERVES[stop.id] ? `Serves the check: ${SERVES_TEXT[SERVES[stop.id]]}.` : 'Close-up taken.'
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
    const go = ui.button('Carry on walking', () => { el.replaceChildren(...[...el.children].filter((c) => c.classList.contains('ss-card'))); onDone() }, true)
    sec.append(time, bar.el, warn, list, go)
    el.replaceChildren(sec, ...[...el.children].filter((c) => c.classList.contains('ss-card')))
    redraw()
    el.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
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
  return { el, at, reset, log, samples: () => samples }
}
