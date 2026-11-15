// The guided mission (docs/UX-PLAN.md): four stages over the 3D scene. This file is the shell: the stepper, the
// regions stages fill, and the shared 2D map. Each stage is one file exporting { enter(ui, app) } that may return a
// cleanup function. Stages talk to the app only through `app` (built at the end of main.js).
import './flow.css'
import { createMap2D } from './map2d.js'
import plan from './stage-plan.js'
import analyse from './stage-analyse.js'
import scout from './stage-scout.js'
import debrief from './stage-debrief.js'

const STAGES = [['plan', 'Plan', plan], ['analyse', 'Read the orbit map', analyse], ['scout', 'Scout', scout], ['debrief', 'Choose the walk', debrief]]
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }

export function initFlow(app) {
  document.body.classList.add('flow')
  const root = h('div', '', '<div id="f-top"><div class="f-steps"></div></div><div id="f-left"></div><div id="f-center"></div><div id="f-right"></div><div id="f-bl"></div><div id="f-bottom"></div><div id="f-br"></div>')
  root.id = 'flow'
  document.body.append(root)
  const region = (id) => root.querySelector(`#f-${id}`)
  const steps = root.querySelector('.f-steps')
  steps.append(...STAGES.map(([, title], k) => h('span', '', `${k + 1}<i> ${title}</i>`)))
  const map = createMap2D(app)
  let cleanup = null, current = -1

  const ui = {
    left: region('left'), right: region('right'), center: region('center'), bottom: region('bottom'), bl: region('bl'), br: region('br'),
    map, // the shared 2D map; put map.el in a region (ui.center / ui.br) and call map.size('big' | 'mini')
    h,
    // A glass card with a small title. Returns the element; append children to it.
    card(title, html = '') { return h('div', 'f-card', `${title ? `<h3>${title}</h3>` : ''}${html}`) },
    // A row of big numbers. items: [[label, value, kind?]] with kind 'scout' | 'hazard' | 'stop'. Returns { el, set(k, value) }.
    stats(items) {
      const el = h('div', 'f-stats')
      const cells = items.map(([label, value, kind]) => { const c = h('div', `f-stat ${kind ?? ''}`, `<b></b><span></span>`); c.firstChild.textContent = value; c.lastChild.textContent = label; el.append(c); return c })
      return { el, set: (k, value) => { cells[k].firstChild.textContent = value } }
    },
    // A progress bar. Returns { el, set(fraction 0..1) }.
    bar() { const el = h('div', 'f-bar', '<i></i>'); return { el, set: (f) => { el.firstChild.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%` } } },
    button(text, onClick, primary = false) { const b = h('button', primary ? 'primary' : ''); b.type = 'button'; b.textContent = text; b.onclick = onClick; return b },
    // One line that appears, stays `ms`, and fades: "Rock field found. Route moves around it."
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
      for (const r of [ui.left, ui.right, ui.center, ui.bottom, ui.bl, ui.br]) r.replaceChildren()
      map.onTap(null)
      map.clear()
      map.fit()
      current = k
      ;[...steps.children].forEach((s, j) => { s.className = j < k ? 'done' : ''; j === k ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current') })
      cleanup = STAGES[k][2].enter(ui, app) ?? null
    },
    stage: () => STAGES[current]?.[0],
  }
  ui.go('plan')
  return ui
}
