// How long Vesta Scout's guided mission blocks the page on each click (issue: "everything feels slow").
// Times, in ms (median of 3 runs), from the click to the next painted frame: each science goal card, "Plan the route", each step of
// stage 2, and starting the scout stage (until the first flight is in the air). Also the longest main-thread task.
// Usage: npm run build && npm run preview -- --port 4178 &   then   node scripts/scout-timing.mjs [label] [url]
// Writes scripts/scout-timing.json ({ [label]: { ...ms } }), keeping other labels, so before/after sit side by side.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const label = process.argv[2] ?? 'now'
const url = process.argv[3] ?? 'http://127.0.0.1:4178/scout/'
const RUNS = 3
const out = new URL('./scout-timing.json', import.meta.url)

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const runs = []
const routes = {} // the planned route after each goal: must not change with speed-ups
for (let r = 0; r < RUNS; r++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url)
  await page.getByRole('button', { name: /^Boxwork/ }).and(page.locator(':enabled')).waitFor()
  await page.waitForTimeout(2000) // a person reads the two cards before choosing
  await page.evaluate(() => {
    window.__long = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long = Math.max(window.__long, e.duration) }).observe({ type: 'longtask' })
  })
  // Click, then wait for the frame after the work: the time the user waits to see the result.
  const time = (find) => page.evaluate(async (find) => {
    const el = find ? [...document.querySelectorAll('#flow button')].find((b) => new RegExp(find).test(b.textContent)) : document.querySelector('#f-foot button.primary')
    const t0 = performance.now()
    el.click()
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))
    return Math.round(performance.now() - t0)
  }, find)
  const m = {}
  const plan = () => page.evaluate(() => { const r = window.vesta.app.route(); return `${r.stops.length} stops, ${r.cells.length} cells, ${r.energy_j.toFixed(1)} J` })
  m.groundwater = await time('^Groundwater')
  routes.groundwater = await plan()
  m.boxwork = await time('^Boxwork')
  routes.boxwork = await plan()
  m.groundwater_again = await time('^Groundwater')
  m.boxwork_again = await time('^Boxwork')
  m.plan_route = await time('^Plan the route')
  for (let s = 1; s <= 4; s++) m[`route_step_${s}`] = await time(null) // the rail's primary button: the next step
  // Starting the scout stage: from the click until the first flight has started.
  m.scout_start = await page.evaluate(async () => {
    const t0 = performance.now()
    const started = new Promise((r) => { const off = window.vesta.app.on('flight:tick', () => { off(); r() }) })
    ;[...document.querySelectorAll('#flow button.primary')].at(-1).click()
    await started
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))
    return Math.round(performance.now() - t0)
  })
  m.longest_task = Math.round(await page.evaluate(() => window.__long))
  m.errors = errors.length
  runs.push(m)
  await page.close()
}
await browser.close()

const median = {}
for (const k of Object.keys(runs[0])) median[k] = runs.map((m) => m[k]).sort((a, b) => a - b)[RUNS >> 1]
const all = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {}
all[label] = { url, runs: RUNS, viewport: '1280x800', renderer: 'headless Chromium, SwiftShader', median_ms: median, routes }
writeFileSync(out, JSON.stringify(all, null, 2) + '\n')
console.log(label, median, routes)
