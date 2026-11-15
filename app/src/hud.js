// Helmet heads-up display for Vesta Vision (issue #41, flag hud): only what matters while walking.
// A compass tape with the next stop and the habitat marked, the way-home margin as an arc and a number,
// oxygen and energy bars, distance and ETA to the next stop, distance and ETA home, a home beacon and a next-stop
// beacon pinned to the view, a heading-up minimap, and one alert line (turn back soon / point of no return).
// Same app state as the map screen (walk.js appState); this file only draws. Shown in the Follow and Eye views.

// Compass bearing in degrees (0 = north, 90 = east) from a direction in app space: +x east, +z south.
export const bearingDeg = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360

// Signed smallest turn from heading a to bearing b, degrees in (-180, 180].
export const turnDeg = (a, b) => ((((b - a) % 360) + 540) % 360) - 180

// The next stop ahead on the route: its name, metres to walk along the route, and its cell.
// route.cells: [[x, y], ...]; k: index of the cell the walker is on; stops: [{ id, name, cell }] in the plan.
export function nextStop(route, k, stops, cs) {
  let metres = 0
  for (let i = k + 1; i < route.cells.length; i++) {
    const [x, y] = route.cells[i], [px, py] = route.cells[i - 1]
    metres += Math.hypot(x - px, y - py) * cs
    const s = stops.find((t) => route.stops.includes(t.id) && t.cell[0] === x && t.cell[1] === y)
    if (s) return { name: s.name ?? s.id, metres, cell: s.cell }
    if (i === route.cells.length - 1) return { name: 'Habitat', metres, cell: route.cells[i] }
  }
  return null
}

// Metres left to walk along the route from cell k to its end (the habitat).
export function remainingMetres(route, k, cs) {
  let m = 0
  for (let i = k + 1; i < route.cells.length; i++) m += Math.hypot(route.cells[i][0] - route.cells[i - 1][0], route.cells[i][1] - route.cells[i - 1][1]) * cs
  return m
}

// "4 min", "1 h 05": walking time for a distance at the planning speed (knobs.speed_mps), stops not included.
export function eta(metres, speedMps) {
  const min = Math.ceil(metres / speedMps / 60)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

// Where a beacon sits on screen: at the point if it is in view, else clamped to the edge it lies beyond.
// p: [x, y, behind] in pixels; returns { x, y, off } with off = true when clamped.
export function beaconSpot([x, y, behind], w, h, pad = 34) {
  if (behind) { x = w - x; y = h - pad } // behind you: mirror and push to the bottom edge
  const cx = Math.max(pad, Math.min(w - pad, x)), cy = Math.max(pad + 60, Math.min(h - pad - 70, y))
  return { x: cx, y: cy, off: behind || cx !== x || cy !== y }
}

// Alert for the margin left after the way home and the reserve. frac: margin / usable energy at the start.
export function alertFor(marginJ, frac) {
  if (marginJ < 0) return { level: 'danger', text: 'PAST THE POINT OF NO RETURN' }
  if (frac < 0.15) return { level: 'warn', text: 'TURN BACK SOON' }
  return null
}

const CSS = `
#helmet{position:fixed;inset:0;z-index:4;pointer-events:none;color:#e9fbff;font:600 14px ui-monospace,SFMono-Regular,Menlo,monospace;
  text-shadow:0 0 6px #000c,0 1px 2px #000;--c:#5fe6ff}
#helmet[hidden]{display:none}
#helmet .visor{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,transparent 55%,#0008 100%);
  box-shadow:inset 0 0 0 2px #5fe6ff22,inset 0 0 90px #000a}
#helmet .tape{position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 24px));height:54px}
#helmet .tape canvas{width:100%;height:100%}
#helmet .box{position:absolute;top:calc(max(10px,env(safe-area-inset-top)) + 62px);padding:8px 10px;border:1px solid #5fe6ff55;border-radius:10px;
  background:#0a141cb3;min-width:136px;max-width:44vw}
#helmet .left{left:max(12px,env(safe-area-inset-left))}
#helmet .right{right:max(12px,env(safe-area-inset-right));text-align:right}
#helmet small{display:block;font-size:10px;letter-spacing:.12em;color:#9fdcec;font-weight:500}
#helmet .big{font-size:26px;line-height:1.1;color:#fff}
#helmet .row{margin-top:6px;font-size:13px}
#helmet .arc{display:block;width:120px;height:66px}
#helmet .alert{position:absolute;left:50%;top:38%;transform:translateX(-50%);padding:8px 16px;border-radius:8px;font-size:18px;letter-spacing:.08em;white-space:nowrap}
#helmet .alert.warn{background:#ffb02ee6;color:#201400;text-shadow:none}
#helmet .alert.danger{background:#e02020e6;color:#fff;animation:hudblink 1s steps(2) infinite}
#helmet .cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px;border:1px solid #5fe6ff88;border-radius:50%}
#helmet .bar{height:8px;border-radius:4px;background:#ffffff26;margin-top:4px;overflow:hidden}
#helmet .bar i{display:block;height:100%;background:#5fe6ff;border-radius:4px}
#helmet .kv{display:flex;justify-content:space-between;gap:10px;margin-top:5px;font-size:13px}
#helmet .kv span:first-child{color:#9fdcec;font-weight:500}
#helmet .beacon{position:absolute;transform:translate(-50%,-50%);display:grid;justify-items:center;gap:2px;font-size:12px;white-space:nowrap}
#helmet .beacon i{width:16px;height:16px;transform:rotate(45deg);border:2px solid currentColor;background:#0008}
#helmet .beacon.off i{background:currentColor}
#helmet .beacon.home{color:#fff}#helmet .beacon.next{color:#ffd23f}
#helmet .mini{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + 62px);
  width:min(30vmin,170px);aspect-ratio:1;border-radius:50%;border:1px solid #5fe6ff66;background:#0a141cb3;overflow:hidden}
#helmet .mini canvas{width:100%;height:100%}
@keyframes hudblink{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){#helmet .alert.danger{animation:none}}
@media (max-width:480px){#helmet .big{font-size:21px}#helmet .arc{width:96px;height:54px}}`

export function initHud() {
  const style = document.createElement('style')
  style.textContent = CSS
  const el = document.createElement('div')
  el.id = 'helmet'
  el.hidden = true
  el.innerHTML = `<div class="visor"></div><div class="cross"></div>
<div class="tape"><canvas width="1120" height="108" aria-hidden="true"></canvas></div>
<div class="box left" role="status"><small>MARGIN HOME</small>
  <svg class="arc" viewBox="0 0 120 66"><path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#ffffff30" stroke-width="8" stroke-linecap="round"/>
  <path id="hudArc" d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#5fe6ff" stroke-width="8" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100"/></svg>
  <div class="big" id="hudMargin"></div>
  <div class="kv"><span>OXYGEN</span><span id="hudO2"></span></div><div class="bar"><i id="hudO2Bar"></i></div>
  <div class="kv"><span>ENERGY</span><span id="hudEnergy"></span></div><div class="bar"><i id="hudEnergyBar"></i></div></div>
<div class="box right" role="status"><small>NEXT STOP</small><div class="big" id="hudDist"></div><div class="row" id="hudStop"></div>
  <div class="kv"><span>ETA</span><span id="hudEta"></span></div>
  <div class="kv"><span>HOME DIRECT</span><span id="hudHome"></span></div>
  <div class="kv"><span>HOME BY ROUTE</span><span id="hudHomeEta"></span></div>
  <div class="kv"><span>ELAPSED</span><span id="hudTime"></span></div></div>
<div class="beacon home" id="hudBHome"><i></i><span></span></div><div class="beacon next" id="hudBNext"><i></i><span></span></div>
<div class="mini" aria-hidden="true"><canvas width="340" height="340"></canvas></div>
<div class="alert" id="hudAlert" role="alert" hidden></div>`
  document.head.append(style)
  document.body.append(el)
  const q = (id) => el.querySelector('#' + id)
  const cv = el.querySelector('.tape canvas'), ctx = cv.getContext('2d')
  const mc = el.querySelector('.mini canvas'), mx = mc.getContext('2d')

  // Minimap: heading up, 160 m to the rim. The route, the stops, the habitat, and you in the middle.
  function mini(s) {
    const w = mc.width, r = w / 2, scale = r / 160, a = (-s.heading * Math.PI) / 180
    mx.clearRect(0, 0, w, w)
    mx.save()
    mx.translate(r, r)
    mx.rotate(a)
    const P = (x, z) => [(x - s.pos[0]) * scale, (z - s.pos[1]) * scale]
    mx.lineWidth = 3
    mx.strokeStyle = '#ffffff55'
    mx.beginPath()
    s.route.forEach(([cx, cy], i) => { const [x, y] = P(cx * s.cs, cy * s.cs); if (i) mx.lineTo(x, y); else mx.moveTo(x, y) })
    mx.stroke()
    mx.strokeStyle = '#5fe6ff'
    mx.beginPath()
    s.route.slice(s.k).forEach(([cx, cy], i) => { const [x, y] = P(cx * s.cs, cy * s.cs); if (i) mx.lineTo(x, y); else mx.moveTo(x, y) })
    mx.stroke()
    mx.fillStyle = '#ffd23f'
    for (const [cx, cy] of s.stops) { const [x, y] = P(cx * s.cs, cy * s.cs); mx.beginPath(); mx.arc(x, y, 7, 0, 7); mx.fill() }
    const [hx, hy] = P(s.home[0], s.home[1])
    mx.fillStyle = '#fff'
    mx.fillRect(hx - 8, hy - 8, 16, 16)
    mx.restore()
    mx.fillStyle = '#5fe6ff' // you, looking up the screen
    mx.beginPath(); mx.moveTo(r, r - 16); mx.lineTo(r - 11, r + 11); mx.lineTo(r + 11, r + 11); mx.fill()
    mx.fillStyle = '#fff'
    mx.font = '600 20px ui-monospace,Menlo,monospace'
    mx.textAlign = 'center'
    mx.fillText('N', r + Math.sin(a) * (r - 16), r - Math.cos(a) * (r - 16) + 7)
  }
  function beacon(node, p, label) {
    const { x, y, off } = beaconSpot(p, innerWidth, innerHeight)
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.classList.toggle('off', off)
    node.lastElementChild.textContent = label
  }
  const kj = (j) => `${Math.round(j / 1000)} kJ`

  function tape(heading, marks) {
    const w = cv.width, h = cv.height, pxPerDeg = w / 120 // 120 degrees across
    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 6
    for (let d = Math.ceil((heading - 60) / 5) * 5; d <= heading + 60; d += 5) {
      const x = w / 2 + (d - heading) * pxPerDeg, deg = ((d % 360) + 360) % 360
      const major = deg % 45 === 0, mid = deg % 15 === 0
      ctx.fillStyle = major ? '#fff' : '#bfefff'
      ctx.fillRect(x - 1, 40, 2, major ? 30 : mid ? 20 : 10)
      if (major) {
        ctx.font = '600 30px ui-monospace,Menlo,monospace'
        ctx.fillText({ 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[deg], x, 32)
      } else if (mid) {
        ctx.font = '500 20px ui-monospace,Menlo,monospace'
        ctx.fillText(String(deg), x, 32)
      }
    }
    for (const { bearing, color, label } of marks) {
      const off = Math.max(-58, Math.min(58, turnDeg(heading, bearing))), x = w / 2 + off * pxPerDeg
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(x, 78); ctx.lineTo(x - 12, 104); ctx.lineTo(x + 12, 104); ctx.fill()
      ctx.font = '700 22px ui-monospace,Menlo,monospace'
      ctx.fillText(label, x + (off <= -58 ? 26 : off >= 58 ? -26 : 0), off <= -58 || off >= 58 ? 98 : 76)
    }
    ctx.fillStyle = '#5fe6ff'
    ctx.fillRect(w / 2 - 2, 36, 4, 40) // lubber line: where you are looking
  }

  return {
    el,
    show(on) { el.hidden = !on },
    // get() returns: { heading, pos: [x, z], next: { name, metres, cell } | null, home: [x, z], cs, marginJ, usableJ, energyJ, budgetJ, o2L, t }
    tick(get) {
      if (el.hidden) return
      const s = get()
      const marks = [{ bearing: bearingDeg(s.home[0] - s.pos[0], s.home[1] - s.pos[1]), color: '#ffffff', label: 'H' }]
      if (s.next && s.next.name !== 'Habitat') {
        marks.push({ bearing: bearingDeg(s.next.cell[0] * s.cs - s.pos[0], s.next.cell[1] * s.cs - s.pos[1]), color: '#ffd23f', label: 'NEXT' })
      }
      tape(s.heading, marks)
      const frac = Math.max(0, Math.min(1, s.marginJ / s.usableJ))
      const a = alertFor(s.marginJ, frac)
      const col = a?.level === 'danger' ? '#ff4b3e' : a ? '#ffb02e' : '#5fe6ff'
      q('hudArc').setAttribute('stroke-dasharray', `${(frac * 100).toFixed(1)} 100`)
      q('hudArc').setAttribute('stroke', col)
      q('hudMargin').textContent = s.marginJ >= 0 ? kj(s.marginJ) : `−${kj(-s.marginJ)}`
      q('hudMargin').style.color = a ? col : '#fff'
      const left = Math.max(0, Math.min(1, s.energyJ / s.budgetJ)), low = left < 0.25 ? '#ffb02e' : '#5fe6ff'
      q('hudEnergy').textContent = `${Math.round(100 * left)}%`
      q('hudO2').textContent = `${s.o2L.toFixed(1)} L`
      for (const id of ['hudO2Bar', 'hudEnergyBar']) { q(id).style.width = `${100 * left}%`; q(id).style.background = low }
      q('hudDist').textContent = s.next ? `${Math.round(s.next.metres)} m` : '—'
      q('hudStop').textContent = s.next ? s.next.name : 'Walk complete'
      const direct = Math.hypot(s.home[0] - s.pos[0], s.home[1] - s.pos[1]), byRoute = remainingMetres({ cells: s.route }, s.k, s.cs)
      q('hudEta').textContent = s.next ? eta(s.next.metres, s.speed) : '—'
      q('hudHome').textContent = `${Math.round(direct)} m`
      q('hudHomeEta').textContent = `${Math.round(byRoute)} m · ${eta(byRoute, s.speed)}`
      beacon(q('hudBHome'), s.project(s.home[0], s.home[1]), `HOME ${Math.round(direct)} m`)
      const nb = q('hudBNext'), showNext = s.next && s.next.name !== 'Habitat'
      nb.hidden = !showNext
      if (showNext) beacon(nb, s.project(s.next.cell[0] * s.cs, s.next.cell[1] * s.cs), `${Math.round(s.next.metres)} m`)
      mini(s)
      const t = Math.round(s.t)
      q('hudTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
      q('hudAlert').hidden = !a
      if (a) { q('hudAlert').textContent = a.text; q('hudAlert').className = `alert ${a.level}` }
    },
  }
}
