// The guided mission (docs/UX-PLAN.md section 0): four stages. This file is the shell: a top bar (home link, the
// stages), one left rail (body + pinned foot), and the main area, which is either the full 2D map ("console": we
// are inside the habitat) or clear so the 3D scene shows ("scene": the scout flight, the walk preview).
// Each stage is one file exporting { enter(ui, app) } that may return a cleanup function. Stages talk to the app
// only through `app` (built at the end of main.js).
import './flow.css'
import { createMap2D } from './map2d.js'
import plan from './stage-plan.js'
import analyse from './stage-analyse.js'
import scout from './stage-scout.js'
import debrief from './stage-debrief.js'

const STAGES = [['plan', 'Stops', plan], ['analyse', 'Route', analyse], ['scout', 'Scout', scout], ['debrief', 'Walk', debrief]]
const BACK = { analyse: 'plan', debrief: 'analyse' } // where Back goes; none while the scout flies
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }

export function initFlow(app) {
  document.body.classList.add('flow')
  const root = h('div', '', `<div id="f-top"><a href="../" aria-label="Back to Mission VESTA">← <span>Vesta <b>Scout</b></span></a><nav class="f-steps" aria-label="Mission steps"></nav><span class="f-context">Mission planner</span></div>
    <div id="f-rail"><div id="f-body"></div><div id="f-foot"></div></div>
    <div id="f-main"><div id="f-strip" class="f-ov"></div><div id="f-bl" class="f-ov"></div><div id="f-bottom" class="f-ov"></div><div id="f-br" class="f-ov"></div></div>`)
  root.id = 'flow'
  document.body.append(root)
  const q = (id) => root.querySelector(`#f-${id}`)
  const main = q('main'), stepsEl = root.querySelector('.f-steps')
  const map = createMap2D(app)
  let cleanup = null, current = -1, reached = 0
  const tabs = STAGES.map(([name, title], k) => { const b = h('button', '', `<span class="f-step-num">${k + 1}</span><span>${title}</span>`); b.type = 'button'; b.onclick = () => { if (b.classList.contains('open')) ui.go(name) }; stepsEl.append(b); return b })

  const ui = {
    body: q('body'), foot: q('foot'), strip: q('strip'), bl: q('bl'), br: q('br'), bottom: q('bottom'), main,
    map, // the shared 2D map. In console stages it already fills the main area; in scene stages put map.el in ui.br and call map.size('mini').
    h,
    // In a scene the 3D picture is shifted so its centre sits in the area the rail leaves free.
    // console (false, default): the 2D map fills the main area, no 3D. scene (true): the main area is clear and the 3D view shows.
    // full (scene only): hide the rail too; the stage draws its own panels over the 3D view (a control centre).
    scene(on, full = false) { main.classList.toggle('scene', on); root.classList.toggle('full', on && full); on && !full ? (innerWidth > 760 ? app.viewShift(q('rail').offsetWidth / 2) : app.viewShift(0, innerHeight * 0.22)) : app.viewShift(0); if (on) map.el.remove(); else { map.size('fill'); main.prepend(map.el) } },
    // A titled block in the rail. big = a heading instead of a small label. Returns the element; append to it.
    section(title, big = false) { return h('div', 'f-sec', title ? `<${big ? 'h2' : 'h3'}>${title}</${big ? 'h2' : 'h3'}>` : '') },
    // Secondary explanations stay available without competing with the stage's next action.
    details(title, ...content) {
      const el = h('details', 'f-details'), summary = h('summary'), body = h('div', 'f-details-body')
      summary.textContent = title; body.append(...content); el.append(summary, body)
      return el
    },
    // A list row: item({ n, title, sub, onRemove, onClick, onHover }). n = the number in the amber dot (omit for none).
    item({ n, title, sub, onRemove, onClick, onHover }) {
      const e = h(onClick ? 'button' : 'div', 'f-item', `${n != null ? '<span class="n"></span>' : ''}<span class="t"></span>`)
      if (n != null) e.firstChild.textContent = n
      const t = e.querySelector('.t'); t.textContent = title
      if (sub) { const s = h('small'); s.textContent = sub; t.append(s) }
      if (onRemove) { const x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', `Remove ${title}`); x.onclick = (ev) => { ev.stopPropagation(); onRemove() }; e.append(x) }
      if (onClick) { e.type = 'button'; e.onclick = onClick }
      if (onHover) { e.onmouseenter = () => onHover(true); e.onmouseleave = () => onHover(false) }
      return e
    },
    // Big numbers. items: [[label, value, kind?]] with kind 'scout' | 'hazard' | 'stop'. Returns { el, set(k, value) }.
    stats(items) {
      const el = h('div', 'f-stats')
      const cells = items.map(([label, value, kind]) => { const c = h('div', `f-stat ${kind ?? ''}`, '<b></b><span></span>'); c.firstChild.textContent = value; c.lastChild.textContent = label; el.append(c); return c })
      return { el, set: (k, value) => { cells[k].firstChild.textContent = value } }
    },
    bar() { const el = h('div', 'f-bar', '<i></i>'); return { el, set: (f) => { el.firstChild.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%` } } },
    button(text, onClick, primary = false) { const b = h('button', `f-btn ${primary ? 'primary' : ''}`); b.type = 'button'; b.textContent = text; b.onclick = onClick; return b },
    // A solid chip for the main area's corners (numbers strip, legends).
    chip(html = '') { return h('div', 'f-chip', html) },
    // A model-card line from flow/models.js: model({ name, score, limit }).
    model(m) { const e = h('div', 'f-model'); e.innerHTML = '<b></b> · <span></span><br><span></span>'; e.children[0].textContent = m.name; e.children[1].textContent = m.score; e.children[3].textContent = m.limit; return e },
    // One line that appears bottom-centre of the main area, stays `ms`, and fades.
    event(text, { hazard = false, ms = 3500 } = {}) {
      const e = h('div', `f-event ${hazard ? 'hazard' : ''}`)
      e.textContent = text
      ui.bottom.prepend(e)
      requestAnimationFrame(() => e.classList.add('on'))
      setTimeout(() => { e.classList.remove('on'); setTimeout(() => e.remove(), 400) }, ms)
    },
    kj: (j) => `${Math.round(j / 1000)}`,
    go(name) {
      const k = STAGES.findIndex(([n]) => n === name)
      cleanup?.()
      for (const r of [ui.body, ui.foot, ui.strip, ui.bl, ui.br, ui.bottom]) r.replaceChildren()
      map.onTap(null); map.onHover?.(null); map.clear(); map.caption('', '')
      ui.scene(false)
      current = k
      reached = Math.max(reached, k)
      const back = BACK[name]
      if (back) { const b = h('button', 'f-back', `← ${STAGES.find(([n]) => n === back)[1]}`); b.type = 'button'; b.onclick = () => ui.go(back); ui.body.append(b) }
      cleanup = STAGES[k][2].enter(ui, app) ?? null
      ui.body.scrollTop = 0
      ui.refreshTabs()
    },
    // Finished stages can be reopened from the top bar, except the flight itself, and never while it is flying.
    refreshTabs() {
      tabs.forEach((b, j) => {
        j === current ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')
        b.classList.toggle('open', j !== current && j <= reached && STAGES[j][0] !== 'scout' && STAGES[current][0] !== 'scout')
        b.disabled = j !== current && !b.classList.contains('open')
      })
    },
    stage: () => STAGES[current]?.[0],
  }
  ui.go('plan')
  return ui
}
