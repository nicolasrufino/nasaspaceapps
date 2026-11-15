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

// How long autoplay stays on a scene: about 0.45 s a word, never under 8 s or over 14 s.
export function lingerMs(html) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length
  return Math.max(8000, Math.min(14000, words * 450))
}

// Margin left after the way home and the reserve, from the app's own state (contract §3).
export const marginJ = (s) => s.energy_left_j - s.reserve_j - s.cost_to_go_j

// The Scout look from the live site (app/src/flow/flow.css: paper, ink, panel, panel2, mute; IBM Plex Sans), with a
// clear order of reading: chapter label, title, body with the key numbers in bold, sources, then the controls.
const CSS = `
#demoCard{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 62px);z-index:7;
  width:min(560px,calc(100vw - 24px));padding:16px 18px 14px;border-radius:12px;background:#1d1c1b;color:#f3f2ef;
  font:14px/1.5 "IBM Plex Sans",system-ui,sans-serif;box-shadow:0 10px 30px #0008}
#demoCard[hidden]{display:none}
#demoCard .ch{font-size:11px;font-weight:700;letter-spacing:.08em;color:#a9a6a2;text-transform:uppercase}
#demoCard h3{margin:3px 0 8px;font-size:19px;font-weight:700;line-height:1.2;letter-spacing:-.01em}
#demoCard p{margin:0 0 8px;color:#e3dfd3}
#demoCard ul{margin:0 0 8px;padding:0;list-style:none;color:#e3dfd3;border-radius:10px;background:#2a2927}
#demoCard li{padding:8px 12px}#demoCard li+li{box-shadow:0 -1px #1d1c1b}
#demoCard b{color:#fff;font-weight:700}
#demoCard .src{font-size:11px;line-height:1.5;color:#a9a6a2;padding-top:8px;box-shadow:0 -1px #2a2927}
#demoCard .src a{color:#e3dfd3;text-underline-offset:2px}
#demoCard .bar{display:flex;align-items:center;gap:8px;margin-top:12px}
#demoCard .dots{flex:1;display:flex;gap:4px}
#demoCard .dots i{flex:1;height:4px;border-radius:2px;background:#2a2927}
#demoCard .dots i.on{background:#e3dfd3}
#demoCard .n{font-size:12px;color:#a9a6a2;font-variant-numeric:tabular-nums}
#demoCard button{font:600 14px "IBM Plex Sans",system-ui,sans-serif;min-height:44px;padding:0 14px;border-radius:10px;border:0;background:#2a2927;color:#f3f2ef;cursor:pointer}
#demoCard button:hover{background:#383530}
#demoCard button.go,#demoCard button[aria-pressed=true]{background:#f3f2ef;color:#191919}
#demoCard button:disabled{opacity:.4;cursor:default}
#demoCard h3+p{font-size:15px}
#demoTab p{margin:0 0 10px;font-size:13px;line-height:1.45;color:#a9a6a2}
#demoTab .lead{font-size:14px;color:#f3f2ef}
#demoTab .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#demoTab code{font-size:12px;color:#e3dfd3}`

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
<p class="lead">One mission, start to finish, on real Gale data: plan, scout, walk, home.</p>
<div class="row"><button id="demoPlay" type="button">Step through</button><button id="demoAutoPlay" type="button">Autoplay</button></div>
<p style="margin-top:8px">Step through: Next and Back move between scenes. Autoplay: each scene stays 8 to 14 seconds; the whole run is about 3 minutes.</p>
`
  tabs.append(tab)
  document.getElementById('walk').after(sec)
  for (const other of tabs.querySelectorAll('[data-tab]')) other.addEventListener('click', () => { sec.hidden = true; tab.setAttribute('aria-selected', 'false') })
  tab.onclick = () => {
    for (const o of tabs.querySelectorAll('[role=tab]')) o.setAttribute('aria-selected', String(o === tab))
    document.getElementById('plan').hidden = document.getElementById('walk').hidden = true
    sec.hidden = false
  }

  // Two ways to watch: step through (each scene waits for Next) or autoplay (each scene stays long enough to read,
  // 8 to 14 s by its length, so the whole run fits a five-minute slot). Back returns to the scene before.
  let run = 0, skip = null, goBack = null, auto = false, need = 8000
  const hold = (my) => new Promise((ok) => { // resolves 'next', 'back', or false when the demo was ended
    let spent = 0, last = performance.now(), go = null
    skip = () => { go = 'next' }
    goBack = () => { go = 'back' }
    const tick = () => {
      if (my !== run) return ok(false)
      const now = performance.now()
      if (auto) spent += now - last
      last = now
      if (go || (auto && spent >= need)) return ok(go ?? 'next')
      setTimeout(tick, 100)
    }
    tick()
  })
  const once = (evt, ms = 60000) => new Promise((ok) => {
    const off = app.on(evt, (d) => { off(); ok(d) })
    setTimeout(() => { off(); ok(null) }, ms)
  })
  const link = (k) => `<a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]}</a>`
  function show(step, of, ch, title, html, sources = []) {
    need = lingerMs(html)
    card.hidden = false
    card.innerHTML = `<div class="ch">${ch}</div><h3>${title}</h3>${html}
${sources.length ? `<div class="src">Sources: ${sources.map(link).join(' · ')}</div>` : ''}
<div class="bar"><div class="dots">${Array.from({ length: of }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
<span class="n">${step + 1} / ${of}</span><button id="demoBack" type="button"${step ? '' : ' disabled'}>Back</button><button id="demoAuto" type="button" aria-pressed="${auto}">Auto</button><button id="demoNext" class="go" type="button">Next</button><button id="demoStop" type="button" aria-label="End the demo">End</button></div>`
    card.querySelector('#demoNext').onclick = () => skip?.()
    card.querySelector('#demoBack').onclick = () => goBack?.()
    card.querySelector('#demoStop').onclick = stop
    card.querySelector('#demoAuto').onclick = (e) => { auto = !auto; e.target.setAttribute('aria-pressed', String(auto)) }
  }
  function stop() {
    run++
    card.hidden = true
    app.walk.pause()
    app.scout.seconds(null)
    ui.contours(false)
    app.camera('map')
  }
  // Walk (or jump back) to step `idx` of the route, then pause there. Next or Back while walking jumps straight to it.
  const walkTo = (idx, my) => new Promise((ok) => {
    const at = app.walk.state().k
    if (at >= idx) { if (at > idx) app.walk.seek(idx); app.walk.pause(); return ok(true) }
    const done = () => { off(); clearInterval(t); app.walk.pause(); ok(my === run) }
    const off = app.on('walk:step', ({ k }) => { if (k >= idx) done() })
    const t = setInterval(() => { if (my !== run) done() }, 200)
    skip = goBack = () => { app.walk.seek(idx); done() }
    app.walk.speed(110)
    app.walk.play()
  })

  async function scouted(autoplay) {
    auto = autoplay
    const my = ++run
    const { meta } = app.world, k = meta.knobs, usable = app.usableJ, v = ui.validation
    app.walk.pause(); app.walk.reset()
    let r0 = null, flown = null, low = Infinity
    const offLow = app.on('walk:step', () => { low = Math.min(low, marginJ(window.appState)) })
    const map = (layer, contours = false) => { app.camera('map'); ui.setLayer(layer); ui.contours(contours) }
    const stopsOf = (r) => r.stops.map((id) => app.stops().find((s) => s.id === id))
    const indexOf = (r, s) => r.cells.findIndex(([x, y]) => x === s.cell[0] && y === s.cell[1])

    // Each scene sets up its own view, shows its card and waits; it returns 'next', 'back' or false (ended).
    const scenes = [
      (i, N) => { map('imagery')
        show(i, N, 'The data · Luca, Galsan', 'Real Mars, not a simulation',
          `<p>A ${(meta.width * meta.cell_size_m / 1000).toFixed(0)} km box of Gale crater: NASA 1 m terrain, 25 cm HiRISE colour.${v ? ` Matches Curiosity's own elevation at ${v.waypoints} stops to <b>${v.terrain_1m.rmse_after_bias_m.toFixed(2)} m</b>.` : ''}</p>`, ['hirise'])
        return hold(my) },
      (i, N) => { map('imagery', true)
        show(i, N, 'The rules · NASA figures', 'What a suited person can cross and afford',
          `<ul><li>Slope up to <b>${k.max_slope_deg}°</b>, step up to <b>${k.step_max_m} m</b></li><li>Energy: Pandolf equation, 1200 BTU/hr suit budget</li><li>Today: <b>${kj(usable)}</b> to spend, reserve kept back</li></ul>`, ['slope', 'step', 'pandolf', 'suit'])
        return hold(my) },
      (i, N) => { map('hazards')
        show(i, N, 'Hazards · Luca', 'Where a person cannot go',
          `<p>Red is too steep. <b>${ui.counts.blocked.toLocaleString()}</b> hidden ledges found in the 1 m terrain; <b>${ui.counts.reviewed}</b> rocks confirmed by a person.</p>`)
        return hold(my) },
      (i, N) => { map('hazards')
        show(i, N, 'Machine learning · Jules', 'One model, kept honest',
          `<p>Ground classifier: <b>${pct(cls.held_out.accuracy)}</b> on Curiosity photos, <b>${pct(cls.perseverance_transfer.metrics.accuracy)}</b> on Perseverance. Not good enough to steer the route, so it does not.</p>`, ['ai4mars'])
        return hold(my) },
      (i, N) => { map('imagery'); r0 ??= app.route()
        show(i, N, 'Plan · Nicolas', 'The route from orbit',
          `<p>${r0.stops.length} stops · <b>${kj(r0.energy_j)}</b> of ${kj(usable)} · ${Math.round(r0.minutes)} min of walking. Orbit cannot see small rocks.</p>`)
        return hold(my) },
      async (i, N) => { map('hazards'); r0 ??= app.route()
        if (!flown && app.scout.left() > 0) { // fly once; coming back here later shows the result
          const flying = (n) => show(i, N, 'Scout · Jules', `Flight ${n} of ${app.MAX_FLIGHTS}`,
            `<p>A simulated helicopter checks the route for hidden rocks before anyone walks.</p>`, ['skyfall'])
          flying(app.scout.used() + 1)
          const offStart = app.on('flight:start', ({ n }) => { if (my === run) flying(n) })
          app.scout.seconds(6)
          const landed = once('landed', 90000)
          app.scout.start() // one press flies every flight the route needs, up to the limit
          const d = await landed
          offStart()
          if (my !== run) return false
          flown = d ?? { flightsUsed: app.scout.used(), found: 0, crossed: 0 }
        }
        flown ??= { flightsUsed: app.scout.used(), found: 0, crossed: 0 }
        show(i, N, 'Scout · the result', 'Fixed before the walk, not during it',
          `<p><b>${flown.flightsUsed}</b> flights · <b>${flown.found}</b> rock cells found, <b>${flown.crossed}</b> on the route. Re-planned: ${kj(r0.energy_j)} → <b>${kj(app.route().energy_j)}</b>.</p>`)
        return hold(my) },
    ]
    const walkScene = (j) => async (i, N) => {
      const r = app.route(), stops = stopsOf(r), here = stops[j]
      app.camera('walker')
      show(i, N, `Walk · stop ${j + 1} of ${stops.length}`, `Walking to ${here.name}`, `<p>Read-outs: margin home, oxygen, next stop, way back.</p>`)
      if (!await walkTo(indexOf(r, here), my)) return false
      const s = window.appState
      show(i, N, `Walk · stop ${j + 1} of ${stops.length}`, here.name,
        `<p>Clock <b>${clock(missionSeconds(s.t, j))}</b> (${STOP_MIN} min planned per stop) · <b>${kj(marginJ(s))}</b> spare after the way home and the reserve.</p>`)
      return hold(my)
    }
    const home = async (i, N) => {
      const r = app.route()
      app.camera('walker')
      show(i, N, 'Home', 'Walking back to the habitat', `<p>The way home was in the budget at every step.</p>`)
      if (!await walkTo(r.cells.length - 1, my)) return false
      const s = window.appState
      app.camera('map')
      show(i, N, 'Home', 'Back safe, reserve untouched',
        `<p><b>${Math.round(app.describe(r.cells).metres)} m</b> · clock <b>${clock(missionSeconds(s.t, r.stops.length))}</b> · lowest margin <b>${kj(low)}</b>. A simulated walk on real NASA terrain; the energy model is an estimate.</p>`)
      return hold(my)
    }
    const all = () => [...scenes, ...app.route().stops.map((_, j) => walkScene(j)), home]
    let i = 0
    while (my === run) {
      const list = all()
      if (i >= list.length) break
      const dir = await list[i](i, list.length)
      if (dir === false || my !== run) break
      i = Math.max(0, i + (dir === 'back' ? -1 : 1))
    }
    offLow()
    if (my === run) stop()
  }

  sec.querySelector('#demoPlay').onclick = () => scouted(false)
  sec.querySelector('#demoAutoPlay').onclick = () => scouted(true)
  tab.click() // arriving with the demo flag opens on this tab
  return { stop }
}
