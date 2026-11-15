// Stage 1, "How the map finds boxwork": a five-step walkthrough of how the candidate sites are found from orbit.
// Same logic as data/pipeline/science_probe.py, recomputed here from the world files at run time:
// landform.u8 (MRO HiRISE 1 m terrain: 0 flat, 1 slope, 2 ridge, 3 hollow) and chem_points.json (MSL ChemCam/APXS
// positions and sols). find.test.js checks the score and the AUC against the Python output. ?off=find skips it all.
const NASA = 'https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/'
export const BOXWORK_SOLS = [4534, 4845] // science_probe.py: entered sol 4534, left about sol 4845 (NASA)
const R = 3 // 7 x 7 cells = 56 m, science_probe.py WINDOW_CELLS

export const findOn = (search = location.search) => !(new URLSearchParams(search).get('off') ?? '').split(',').includes('find')

// sqrt(ridge share x hollow share) in a 7 x 7 window, edges padded with the edge cell (numpy mode="edge").
// Integer counts / 49, then sqrt: the same floating-point steps as the Python, so values match exactly.
export function boxworkScore(lf, W, H) {
  const out = new Float64Array(W * H), k = (2 * R + 1) ** 2
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, h = 0
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const v = lf[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]
      if (v === 2) r++; else if (v === 3) h++
    }
    out[y * W + x] = Math.sqrt((r / k) * (h / k))
  } // ponytail: 49 reads per cell, 3 M reads on 256 x 256, a few ms; summed-area table if worlds grow
  return out
}

// Share of cells scoring below this one, in % (science_probe.py stop_percentile_on_score).
export const percentile = (score, W, [x, y]) => { const s = score[y * W + x]; let n = 0; for (const v of score) if (v < s) n++; return Math.round((n / score.length) * 1000) / 10 }

// Rover cells inside the boxwork (every sol there inside) vs outside (no sol inside), and the AUC between them.
export function roverCheck(score, W, chem) {
  const cells = new Map()
  for (const p of chem) { const key = `${p.cell}`; if (!cells.has(key)) cells.set(key, { cell: p.cell, sols: [] }); cells.get(key).sols.push(p.sol) }
  const isIn = (s) => s >= BOXWORK_SOLS[0] && s <= BOXWORK_SOLS[1]
  const inside = [], outside = []
  for (const c of cells.values()) {
    if (c.sols.every(isIn)) inside.push(c.cell); else if (!c.sols.some(isIn)) outside.push(c.cell)
  }
  const at = ([x, y]) => score[y * W + x]
  let sum = 0
  for (const a of inside) for (const b of outside) sum += at(a) > at(b) ? 1 : at(a) === at(b) ? 0.5 : 0
  return { inside, outside, auc: sum / (inside.length * outside.length) }
}

// Load the two layers; null if either fails (the button then stays hidden).
export async function loadFind(app) {
  try {
    const dir = `${import.meta.env.BASE_URL}${new URLSearchParams(location.search).get('world') ?? 'gale'}/`
    const [lf, chem] = await Promise.all([
      fetch(`${dir}landform.u8`).then((r) => (r.ok ? r.arrayBuffer() : null)),
      fetch(`${dir}chem_points.json`).then((r) => (r.ok ? r.json() : null)),
    ])
    const { W, H } = app
    if (!lf || lf.byteLength !== W * H || !Array.isArray(chem) || !chem.length) return null
    const landform = new Uint8Array(lf), score = boxworkScore(landform, W, H)
    const check = roverCheck(score, W, chem)
    if (!check.inside.length || !check.outside.length) return null
    let max = 0
    for (const v of score) if (v > max) max = v
    return { landform, score, max, ...check }
  } catch { return null }
}

const RIDGE = [255, 210, 63], HOLLOW = [80, 190, 255]
const swatch = ([r, g, b], text) => `<span style="color:rgb(${r},${g},${b});font-weight:700">■ ${text}</span>`

// The button that opens the walkthrough, or null when ?off=find or a file fails. Returns { el, close }.
export async function findButton(ui, app, cands, addCands) {
  if (!findOn()) return null
  const d = await loadFind(app)
  if (!d) return null
  const { map } = ui
  let closeFn = null
  const sec = ui.section('')
  const btn = ui.button('How the map finds boxwork', () => open())
  btn.setAttribute('aria-label', 'How the map finds boxwork: five steps')
  sec.append(btn)

  function open() {
    const keep = { body: [...ui.body.childNodes], foot: [...ui.foot.childNodes], cap: [...map.el.querySelectorAll('.cap, .cap2')].map((e) => e.textContent) }
    ui.body.replaceChildren(); ui.foot.replaceChildren()
    const n = d.inside.length + d.outside.length, auc = d.auc.toFixed(3), pct = Math.round(d.auc * 100)
    const letter = (k) => String.fromCharCode(65 + k)
    const STEPS = [
      { title: 'What boxwork looks like', text: [`Low ridges, 1 to 2 m tall, with sandy hollows between: from orbit, a spiderweb. This is the NASA HiRISE picture as it is. <a href="${NASA}" target="_blank" rel="noopener" style="color:inherit">NASA ↗</a>`] },
      { title: 'Ridges and hollows', text: ['From NASA’s 1 m terrain: a cell is a ridge when it stands 0.5 m above its 21 m surroundings, a hollow when it sits 0.5 m below.'],
        small: `${swatch(RIDGE, 'ridge')} · ${swatch(HOLLOW, 'hollow')}` },
      { title: 'Where both crowd together', text: ['Boxwork needs ridges and hollows side by side. Each 8 m cell scores √(ridge share × hollow share) in the 56 m square around it.'],
        small: 'Brighter = more of both nearby.' },
      { title: 'Does it work?', text: [`${n} places Curiosity measured: ${swatch([255, 255, 255], `${d.inside.length} inside the boxwork`)}, ${swatch([255, 90, 70], `${d.outside.length} outside`)}. Pick one of each: the inside one scores higher ${pct}% of the time (AUC ${auc}).`],
        small: `${n} places, all on Curiosity’s own path. A guide; the crew decides.` },
      { title: 'The sites to visit', text: [`The ${cands.length} highest-scoring places you can reach and walk back from, at least 80 m apart, none visited by Curiosity.`], list: true },
    ]
    const wrap = ui.h('div', 'fa-wrap'), head = ui.h('div'), count = ui.h('div', 'fa-count'), prog = ui.h('div', 'fa-prog'), body = ui.h('div', 'fa-wrap')
    const segs = STEPS.map((s, k) => { const b = ui.h('button'); b.type = 'button'; b.textContent = k + 1; b.title = s.title; b.setAttribute('aria-label', `Step ${k + 1}: ${s.title}`); b.onclick = () => show(k); prog.append(b); return b })
    head.append(count, prog); wrap.append(head, body); ui.body.append(wrap)
    const row = ui.h('div', 'f-row')
    const backBtn = ui.button('Back', () => (step === 0 ? close() : show(step - 1)))
    const nextBtn = ui.button('', () => (step === STEPS.length - 1 ? close() : show(step + 1)), true)
    backBtn.style.flex = '0 0 84px'
    row.append(backBtn, nextBtn); ui.foot.append(row)
    let step = 0

    const px = [0, 0, 0, 0]
    const heat = (alpha) => map.paint((i) => { const t = d.score[i] / d.max; if (!(t > 0)) return null; px[0] = 255; px[1] = 90 + 150 * t; px[2] = 40; px[3] = alpha * (0.25 + 0.75 * t); return px })
    function show(s) {
      step = s
      map.clear('find-rover'); map.clear('find-sites')
      const k = map.scale
      if (s === 0) map.paint(() => null)
      else if (s === 1) map.paint((i) => { const v = d.landform[i]; return v === 2 ? [...RIDGE, 190] : v === 3 ? [...HOLLOW, 190] : null })
      else heat(s === 4 ? 120 : 220)
      if (s === 3) map.dots('find-rover', [...d.outside.map((cell) => ({ cell, color: '#ff5a46', r: 0.9 * k })), ...d.inside.map((cell) => ({ cell, color: '#fff', r: 0.9 * k }))])
      if (s === 4) map.dots('find-sites', cands.map((c, j) => ({ cell: c.cell, label: letter(j), color: '#7fe3ff', r: 1.7 * k })))
      const st = STEPS[s]
      count.textContent = `How the map finds boxwork ${s + 1} / ${STEPS.length}`
      segs.forEach((b, j) => { b.className = j === s ? 'now' : j < s ? 'done' : ''; j === s ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current') })
      const sec = ui.section(st.title, true)
      sec.classList.add('fa-text')
      for (const t of st.text) sec.append(ui.h('p', '', t))
      if (st.small) sec.append(ui.h('p', 'dim', st.small))
      if (st.list) {
        const list = ui.h('div', 'f-list')
        cands.forEach((c, j) => list.append(ui.item({ n: letter(j), title: c.name, sub: c.why })))
        const have = () => { const on = new Set(app.stops().filter((x) => x.included).map((x) => `${x.cell}`)); return cands.every((c) => on.has(`${c.cell}`)) }
        const add = ui.button('', () => { addCands(); add.disabled = true; add.textContent = 'Sites added ✓' })
        add.disabled = have(); add.textContent = add.disabled ? 'Sites added ✓' : `+ Add ${cands.length} sites as stops`
        sec.append(list, add)
      }
      body.replaceChildren(sec)
      backBtn.textContent = s === 0 ? 'Close' : 'Back'
      nextBtn.textContent = s === STEPS.length - 1 ? 'Done' : `Next: ${STEPS[s + 1].title}`
    }
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) show(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) show(step - 1)
    }
    addEventListener('keydown', onKey)
    map.caption('How the map finds boxwork', 'NASA MRO HiRISE 1 m terrain · MSL ChemCam and APXS positions')
    map.fit()
    function close() {
      removeEventListener('keydown', onKey)
      map.paint(() => null); map.clear('find-rover'); map.clear('find-sites')
      ui.body.replaceChildren(...keep.body); ui.foot.replaceChildren(...keep.foot)
      map.caption(...keep.cap)
      map.fit([app.meta.base_cell, ...app.stops().map((x) => x.cell)], 20)
      closeFn = null
    }
    closeFn = close
    show(0)
  }
  return { el: sec, close: () => closeFn?.() }
}
