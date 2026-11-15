// Demo tab for Vesta Vision (flag demo, off by default): one mission played from start to finish with captions.
// It drives the real app through the same hooks the guided mission uses (plan, scout flights, walk); it invents
// nothing. Every number in a caption is read at run time from the world files, the live planner, or
// ml/exports/terrain_cls.json; every claim that comes from outside the repo carries its source link.
// Chapters: the data, the rules, what machine learning does and does not do, the plan, the scout, the walk, home.
import cls from '../../ml/exports/terrain_cls.json'

const SRC = {
  hirise: ['USGS MSL Gale DEM and HiRISE mosaic', 'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m'],
  suit: ['NASA Mars suit life-support plan, ICES 2026', 'https://ntrs.nasa.gov/api/citations/20260003024/downloads/Final_ICES2026_Mars_PLSS_Plan.pdf'],
  slope: ['NASA xEVA testing overview, slopes up to 20°', 'https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf'],
  step: ['NASA step-height study, ICES-2025-294', 'https://ntrs.nasa.gov/api/citations/20250004496/downloads/ICES2025-294-stepheight-final.pdf'],
  pandolf: ['Pandolf walking-energy equation', 'https://en.wikipedia.org/wiki/Pandolf_equation'],
  sand: ['Lejeune et al. 1998, walking on sand', 'https://pubmed.ncbi.nlm.nih.gov/9622579/'],
  ai4mars: ['NASA AI4Mars labelled images', 'https://ntrs.nasa.gov/citations/20220008371'],
  skyfall: ['NASA SkyFall mission information package', 'https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf'],
}
const kj = (j) => `${Math.round(j / 1000)} kJ`
const pct = (x) => `${(100 * x).toFixed(1)}%`
const clock = (s) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` }
export const STOP_MIN = 30 // time at each stop: the energy budget's own planning assumption (world.json energy_budget_note)

// Mission clock at a stop: walking time so far plus the planned time at the stops already done.
export const missionSeconds = (walkSeconds, stopsDone) => walkSeconds + stopsDone * STOP_MIN * 60

// How long autoplay stays on a scene: about 0.35 s a word, never under 15 s or over 20 s.
export function lingerMs(html) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length
  return Math.max(15000, Math.min(20000, words * 350))
}

// Margin left after the way home and the reserve, from the app's own state (contract §3).
export const marginJ = (s) => s.energy_left_j - s.reserve_j - s.cost_to_go_j

const CSS = `
#demoCard{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 62px);z-index:7;
  width:min(560px,calc(100vw - 24px));padding:14px 16px;border-radius:16px;background:#10161df0;border:1px solid #ffffff24;color:#eef3f7;
  font:14px/1.45 "Rethink Sans",system-ui,sans-serif;box-shadow:0 12px 40px #000a}
#demoCard[hidden]{display:none}
#demoCard .ch{font-size:11px;font-weight:700;letter-spacing:.12em;color:#35e0ff;text-transform:uppercase}
#demoCard h3{margin:2px 0 6px;font-size:18px;line-height:1.2}
#demoCard p{margin:0 0 6px}
#demoCard ul{margin:0 0 6px;padding-left:1.1em}
#demoCard .src{font-size:11px;color:#9fb0c0}
#demoCard .src a{color:#9fdcec}
#demoCard .bar{display:flex;align-items:center;gap:8px;margin-top:8px}
#demoCard .dots{flex:1;display:flex;gap:4px}
#demoCard .dots i{flex:1;height:3px;border-radius:2px;background:#ffffff26}
#demoCard .dots i.on{background:#35e0ff}
#demoCard .n{font-size:11px;color:#9fb0c0;font-variant-numeric:tabular-nums}
#demoCard button[aria-pressed=true]{background:#34c759;color:#04210d}
#demoCard button{font:600 13px "Rethink Sans",system-ui,sans-serif;min-height:36px;padding:0 12px;border-radius:9px;border:0;background:#ffffff1f;color:#fff;cursor:pointer}
#demoCard button.go{background:#35e0ff;color:#08222b}
#demoTab p{margin:0 0 8px;font-size:12px;color:#9fb0c0}`

// app: the hooks main.js gives the guided mission. ui: { setLayer(name), contours(on), counts: { blocked, reviewed }, validation }
export function initDemo(app, ui) {
  const style = Object.assign(document.createElement('style'), { textContent: CSS })
  const card = Object.assign(document.createElement('div'), { id: 'demoCard', hidden: true })
  card.setAttribute('role', 'status')
  document.head.append(style)
  document.body.append(card)

  // The Demo tab, next to Plan and Walk.
  const tabs = document.querySelector('#hud [role=tablist]')
  const tab = Object.assign(document.createElement('button'), { textContent: 'Demo' })
  tab.setAttribute('role', 'tab')
  tab.setAttribute('aria-selected', 'false')
  const sec = Object.assign(document.createElement('section'), { id: 'demoTab', hidden: true })
  sec.innerHTML = `<h2>Mission walkthrough</h2>
<p>One mission from start to finish on the real Gale data: the plan from orbit, three scout flights, the walk and the way home. Captions say where each number comes from.</p>
<div class="row"><button id="demoPlay" type="button">Step through</button><button id="demoAutoPlay" type="button">Autoplay</button></div>
<p style="margin-top:8px">Step through: each scene waits for Next. Autoplay: each scene stays 15 to 20 seconds, then moves on.</p>
<p style="margin-top:8px">Uses the energy scenario in the title. Add <code>&amp;scenario=ideal</code> to the link for a fresh 8 h suit.</p>`
  tabs.append(tab)
  document.getElementById('walk').after(sec)
  for (const other of tabs.querySelectorAll('[data-tab]')) other.addEventListener('click', () => { sec.hidden = true; tab.setAttribute('aria-selected', 'false') })
  tab.onclick = () => {
    for (const o of tabs.querySelectorAll('[role=tab]')) o.setAttribute('aria-selected', String(o === tab))
    document.getElementById('plan').hidden = document.getElementById('walk').hidden = true
    sec.hidden = false
  }

  // Two ways to watch: step through (each scene waits for Next) or autoplay (each scene lingers long enough to
  // read: 15 to 20 s by its length, then moves on). Next always moves on at once; autoplay can be switched mid-run.
  let run = 0, skip = null, auto = false, need = 15000
  const hold = (my) => new Promise((ok) => {
    let spent = 0, last = performance.now(), go = false
    skip = () => { go = true }
    const tick = () => {
      if (my !== run) return ok(false)
      const now = performance.now()
      if (auto) spent += now - last
      last = now
      if (go || (auto && spent >= need)) return ok(true)
      setTimeout(tick, 100)
    }
    tick()
  })
  const once = (evt, my, ms = 60000) => new Promise((ok) => {
    const off = app.on(evt, (d) => { off(); ok(d) })
    setTimeout(() => { off(); ok(null) }, ms)
    void my
  })
  const link = (k) => `<a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]}</a>`
  function show(step, of, ch, title, html, sources = []) {
    need = lingerMs(html)
    card.hidden = false
    card.innerHTML = `<div class="ch">${ch}</div><h3>${title}</h3>${html}
${sources.length ? `<div class="src">Sources: ${sources.map(link).join(' · ')}</div>` : ''}
<div class="bar"><div class="dots">${Array.from({ length: of }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
<span class="n">${step + 1} / ${of}</span><button id="demoAuto" type="button" aria-pressed="${auto}">Autoplay: ${auto ? 'on' : 'off'}</button><button id="demoNext" class="go" type="button">Next</button><button id="demoStop" type="button">End</button></div>`
    card.querySelector('#demoNext').onclick = () => skip?.()
    card.querySelector('#demoStop').onclick = stop
    card.querySelector('#demoAuto').onclick = (e) => { auto = !auto; e.target.textContent = `Autoplay: ${auto ? 'on' : 'off'}`; e.target.setAttribute('aria-pressed', String(auto)) }
  }
  function stop() {
    run++
    card.hidden = true
    app.walk.pause()
    app.scout.seconds(null)
    ui.contours(false)
    app.camera('map')
  }

  async function scouted(autoplay) {
    auto = autoplay
    const my = ++run, N = 9
    const { meta } = app.world, k = meta.knobs
    const usable = app.usableJ, sc = meta.scenarios?.[meta.default_scenario]
    app.walk.pause(); app.walk.reset(); app.camera('map'); ui.setLayer('imagery'); ui.contours(false)

    const v = ui.validation
    show(0, N, 'The data · Luca, Galsan', 'This is Mars, not a made-up world',
      `<p>The ground is a ${(meta.width * meta.cell_size_m / 1000).toFixed(1)} km box of Gale crater: NASA's 1 m terrain and 25 cm HiRISE colour, where Curiosity studied the boxwork ridges.</p>
<p>${v ? `Checked against the rover: at ${v.waypoints} of Curiosity's own stops our terrain is within ${v.terrain_1m.rmse_after_bias_m.toFixed(2)} m of its recorded elevation (1 m terrain; ${v.grid_8m.rmse_after_bias_m.toFixed(2)} m on the ${meta.cell_size_m} m grid).` : ''}</p>`, ['hirise'])
    if (!await hold(my)) return

    ui.contours(true)
    show(1, N, 'The rules · from NASA figures', 'What a suited person can cross, and afford',
      `<ul><li>Slopes up to <b>${k.max_slope_deg}°</b>; steps up to <b>${k.step_max_m} m</b>.</li>
<li>Walking energy: the Pandolf equation with ${k.body_kg} kg of crew and ${k.load_kg} kg of suit and kit; sand costs ${k.sand_cost_ratio}× firm ground. The Mars gravity factor (${k.gravity_energy_factor}) is an estimate.</li>
<li>Energy budget: suit hours × 1200 BTU/hr, less time at stops and a 1.5 h reserve${sc ? ` — today: <b>${sc.name}</b>, ${kj(usable)} to spend` : ''}.</li></ul>`, ['slope', 'step', 'pandolf', 'sand', 'suit'])
    if (!await hold(my)) return

    ui.contours(false); ui.setLayer('hazards')
    show(2, N, 'Hazards · Luca', 'What stops a person, drawn on the map',
      `<p>Green is walkable, amber is near the limit, red is too steep. Red walls mark <b>${ui.counts.blocked.toLocaleString()}</b> places that look walkable on the ${meta.cell_size_m} m map but have a ledge or steep run in the 1 m terrain. White pins are <b>${ui.counts.reviewed}</b> rocks a person confirmed from NASA/JPL's ROSCO detector.</p>`, ['hirise'])
    if (!await hold(my)) return

    show(3, N, 'Machine learning · Jules', 'One trained model, and it does not steer the route',
      `<p>A ground-photo classifier trained on ${cls.training.train_patches} patches of Curiosity photos (NASA AI4Mars labels) scores <b>${pct(cls.held_out.accuracy)}</b> on ${cls.held_out.samples} held-out Curiosity patches and <b>${pct(cls.perseverance_transfer.metrics.accuracy)}</b> on ${cls.perseverance_transfer.metrics.samples} Perseverance patches, so it does not carry over to a new site.</p>
<p>It is off in this demo. The hazards here are terrain rules plus hand-checked rocks, not a model's guess.</p>`, ['ai4mars'])
    if (!await hold(my)) return

    ui.setLayer('imagery')
    const r0 = app.route()
    show(4, N, 'Plan · Nicolas', 'The route from orbit data alone',
      `<p>${r0.stops.length} science stops, in the order that costs least energy: <b>${kj(r0.energy_j)}</b> of ${kj(usable)}, ${Math.round(r0.minutes)} min of walking. It avoids sand and steep ground, but orbit cannot see rocks under about 1.5 m.</p>`)
    if (!await hold(my)) return

    app.scout.seconds(7)
    let found = 0, crossed = 0, flights = 0
    const flying = (n) => show(5, N, 'Scout · Jules', `Flight ${n} of ${app.MAX_FLIGHTS}: look before anyone walks`,
      `<p>A simulated helicopter flies the next unseen stretch of the route, ${app.scout.flightM} m at most, and uncovers the full-detail hazard layer in a strip ${2 * app.scout.swathM} m wide. The route is re-planned after each landing.</p>
<p>No sensor is simulated: a flight reveals data already in our files. The helicopter is modelled on NASA's planned SkyFall scouts.</p>`, ['skyfall'])
    if (app.scout.left() > 0) {
      flying(app.scout.used() + 1)
      const offStart = app.on('flight:start', ({ n }) => { if (my === run) flying(n) })
      const landed = once('landed', my, 90000)
      app.scout.start() // one press flies every flight the route needs, up to the limit
      const d = await landed
      offStart()
      if (my !== run) return
      if (d) { flights = d.flightsUsed; found = d.found; crossed = d.crossed }
    }
    const r1 = app.route()
    show(6, N, 'Scout · the result', 'The plan changes before the walk, not during it',
      `<p>${flights} flight${flights === 1 ? '' : 's'}: <b>${found}</b> rock cells found, <b>${crossed}</b> of them on the planned route. The route was re-planned after each landing: ${kj(r0.energy_j)} → <b>${kj(r1.energy_j)}</b>, and it now crosses none of the hazards found.</p>`)
    if (!await hold(my)) return

    // The walk: follow view with the helmet read-outs; pause at each stop with the mission clock.
    app.camera('walker')
    app.walk.reset()
    app.walk.speed(150)
    const stops = app.stops().filter((s) => r1.stops.includes(s.id))
    let done = 0, low = Infinity
    const off = app.on('walk:step', ({ k: at }) => {
      const s = window.appState
      low = Math.min(low, marginJ(s))
      const [x, y] = r1.cells[at]
      const here = stops.find((t) => t.cell[0] === x && t.cell[1] === y && !t.seen)
      if (!here) return
      here.seen = true
      app.walk.pause()
      const t = missionSeconds(s.t, done)
      done++
      show(7, N, `Walk · stop ${done} of ${stops.length}`, here.name,
        `<p>Mission clock <b>${clock(t)}</b> (walking ${clock(s.t)}, plus ${STOP_MIN} min planned at each earlier stop). Energy left ${kj(s.energy_left_j)}; after the way home and the reserve, <b>${kj(marginJ(s))}</b> to spare.</p>
<p>${here.why ?? ''} The crew works here for ${STOP_MIN} min: that time is already taken out of the budget.</p>`)
      hold(my).then((ok) => { if (ok && my === run) app.walk.play() })
    })
    show(7, N, 'Walk · the helmet view', 'Every step keeps the way home in the budget',
      `<p>The read-outs track the real walk: margin home, oxygen, distance and time to the next stop, and the habitat's bearing. If the margin ran out, the screen would say turn back.</p>`)
    app.walk.play()
    while (my === run) { // until the walker is back at the habitat
      const st = app.walk.state()
      if (st.k >= st.of) break
      await new Promise((ok) => setTimeout(ok, 300))
    }
    off()
    if (my !== run) return
    const s = window.appState
    app.camera('map')
    show(8, N, 'Home', 'Back at the habitat, with the reserve untouched',
      `<p>${stops.length} stops, ${Math.round(app.describe(r1.cells).metres)} m walked, mission clock <b>${clock(missionSeconds(s.t, stops.length))}</b>. Energy used ${kj(meta.energy_budget_j - s.energy_left_j)}; the smallest margin on the whole walk was <b>${kj(low)}</b> above the way home and the reserve.</p>
<p>A simulated walk and scout on real NASA terrain: not a field trial. The energy model is an estimate.</p>`)
    await hold(my)
    if (my === run) stop()
  }

  sec.querySelector('#demoPlay').onclick = () => scouted(false)
  sec.querySelector('#demoAutoPlay').onclick = () => scouted(true)
  tab.click() // arriving with the demo flag opens on this tab
  return { stop }
}
