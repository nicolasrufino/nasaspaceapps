// The 2D orbit map of the guided mission: the HiRISE picture (NASA/JPL-Caltech/University of Arizona), north up,
// with the route, stops and what the scout has seen drawn over it. Coordinates are cells: (0,0) north-west.
const NS = 'http://www.w3.org/2000/svg'
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e }

export function createMap2D(app) {
  const { W, H } = app
  const root = Object.assign(document.createElement('div'), { className: 'f-map big' })
  root.innerHTML = '<canvas></canvas><canvas></canvas><svg></svg><div class="cap"></div><div class="cap2"></div>'
  const [base, seen] = root.querySelectorAll('canvas'), svg = root.querySelector('svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  seen.width = W; seen.height = H // one pixel per cell: what the scout has looked at, and the rocks it found
  seen.style.imageRendering = 'pixelated'
  let view = { x0: 0, y0: 0, size: W }
  const layers = {} // named SVG groups, drawn in the order they are first used
  const group = (name) => layers[name] ??= svg.appendChild(el('g', { 'data-layer': name }))

  function drawBase() {
    const img = app.imagery()
    base.width = base.height = 1024
    const c = base.getContext('2d')
    if (img) c.drawImage(img, 0, 0, 1024, 1024)
    else { c.fillStyle = '#6b4a3a'; c.fillRect(0, 0, 1024, 1024) }
  }
  drawBase()
  app.on('imagery', drawBase)

  const api = {
    el: root, svg, W, H,
    caption(text, sub = '') { root.querySelector('.cap').textContent = text; root.querySelector('.cap2').textContent = sub },
    size(kind) { root.className = `f-map ${kind}` }, // 'big' or 'mini'
    // A polyline through cells. style: { color, width (cells), dash, opacity }. Same name replaces the old one.
    line(name, cells, { color = '#fff', width = 1.6, dash = '', opacity = 1 } = {}) {
      const g = group(name)
      g.replaceChildren()
      if (!cells?.length) return null
      const p = el('polyline', { points: cells.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' '), fill: 'none', stroke: color,
        'stroke-width': width, 'stroke-dasharray': dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity })
      g.append(p)
      return p
    },
    // Draw a line on over `ms` (for "the route draws itself").
    drawOn(name, ms = 1200) {
      const p = layers[name]?.firstChild
      if (!p) return
      const n = p.getTotalLength()
      p.style.strokeDasharray = n
      p.style.strokeDashoffset = n
      p.getBoundingClientRect()
      p.style.transition = `stroke-dashoffset ${ms}ms ease-in-out`
      p.style.strokeDashoffset = 0
    },
    // Round markers. items: [{ cell, label, color, r, ring, id, faded }]. onTap(id) optional.
    dots(name, items, onTap) {
      const g = group(name)
      g.replaceChildren(...items.map((it) => {
        const [x, y] = it.cell, r = it.r ?? 5
        const n = el('g', { transform: `translate(${x + 0.5},${y + 0.5})`, opacity: it.faded ? 0.45 : 1, 'data-hit': '' })
        n.append(el('circle', { r, fill: it.color ?? '#ffd23f', stroke: it.ring ?? '#191919', 'stroke-width': r * 0.28 }))
        if (it.label != null) { const t = el('text', { 'text-anchor': 'middle', y: r * 0.36, 'font-size': r * 1.05, 'font-weight': 700, fill: '#191919', 'font-family': 'system-ui' }); t.textContent = it.label; n.append(t) }
        if (onTap) { n.style.cursor = 'pointer'; n.style.pointerEvents = 'auto'; n.addEventListener('click', (e) => { e.stopPropagation(); onTap(it.id) }) }
        return n
      }))
    },
    // Paint per-cell colours: fn(i) returns [r, g, b, a] (0-255) or null for clear. Used for seen ground, rocks, belief.
    paint(fn) {
      const c = seen.getContext('2d'), img = c.createImageData(W, H)
      for (let i = 0; i < W * H; i++) { const v = fn(i); if (v) img.data.set(v, i * 4) }
      c.putImageData(img, 0, 0)
    },
    // The standard picture of scouting: unseen ground dimmed, found rocks red.
    paintScouted(dim = 110) { api.paint((i) => (app.rockSeen(i) ? [255, 70, 50, 255] : app.scanned[i] ? null : [20, 16, 14, dim])) },
    // Zoom to the square that holds these cells plus `pad` cells around; fit() with no cells shows the whole slice.
    fit(cells, pad = 14) {
      let x0 = 0, y0 = 0, size = W
      if (cells?.length) {
        const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1])
        size = Math.min(W, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 2 * pad)
        x0 = Math.max(0, Math.min(W - size, (Math.max(...xs) + Math.min(...xs)) / 2 - size / 2))
        y0 = Math.max(0, Math.min(H - size, (Math.max(...ys) + Math.min(...ys)) / 2 - size / 2))
      }
      view = { x0, y0, size }
      svg.setAttribute('viewBox', `${x0} ${y0} ${size} ${size}`)
      for (const c of [base, seen]) Object.assign(c.style, { width: `${(W / size) * 100}%`, height: `${(H / size) * 100}%`, left: `${(-x0 / size) * 100}%`, top: `${(-y0 / size) * 100}%`, inset: 'auto' })
      api.scale = size / W // multiply marker radii and line widths by this to keep them the same size on screen
    },
    scale: 1,
    // clear('name') empties one layer; clear() removes every layer and the paint (layers stack in the order they are first drawn).
    clear(name) { if (name) layers[name]?.replaceChildren(); else { for (const k in layers) { layers[k].remove(); delete layers[k] } seen.getContext('2d').clearRect(0, 0, W, H) } },
    raise(name) { if (layers[name]) svg.append(layers[name]) }, // draw this layer on top
    // Tap on empty map: fn([x, y]) in cells.
    onTap(fn) { root.onclick = fn && ((e) => { const b = root.getBoundingClientRect(); fn([Math.floor(view.x0 + ((e.clientX - b.left) / b.width) * view.size), Math.floor(view.y0 + ((e.clientY - b.top) / b.height) * view.size)]) }) },
  }
  return api
}
