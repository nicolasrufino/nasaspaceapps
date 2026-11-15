// Helmet heads-up display for Vesta Vision (issue #41, flag hud): only what matters while walking.
// A compass tape with the next stop and the habitat marked, the way-home margin as an arc and a number,
// energy, oxygen, time, distance to the next stop, and one alert line (turn back soon / point of no return).
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
  <div class="big" id="hudMargin"></div><div class="row" id="hudEnergy"></div><div class="row" id="hudO2"></div></div>
<div class="box right" role="status"><small>NEXT STOP</small><div class="big" id="hudDist"></div><div class="row" id="hudStop"></div>
  <div class="row" id="hudHome"></div><div class="row" id="hudTime"></div></div>
<div class="alert" id="hudAlert" role="alert" hidden></div>`
  document.head.append(style)
  document.body.append(el)
  const q = (id) => el.querySelector('#' + id)
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d')
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
      q('hudEnergy').textContent = `ENERGY ${Math.round((100 * Math.max(s.energyJ, 0)) / s.budgetJ)}%`
      q('hudO2').textContent = `O₂ ${s.o2L.toFixed(1)} L`
      q('hudDist').textContent = s.next ? `${Math.round(s.next.metres)} m` : '—'
      q('hudStop').textContent = s.next ? s.next.name : 'Walk complete'
      q('hudHome').textContent = `HOME ${Math.round(Math.hypot(s.home[0] - s.pos[0], s.home[1] - s.pos[1]))} m`
      const t = Math.round(s.t)
      q('hudTime').textContent = `T+ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
      q('hudAlert').hidden = !a
      if (a) { q('hudAlert').textContent = a.text; q('hudAlert').className = `alert ${a.level}` }
    },
  }
}
