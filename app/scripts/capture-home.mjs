// Captures the real app views the home page shows, so its pictures and numbers come from a run, not a mockup.
// Scout: the guided flow with the first three suggested stops, all flights skipped; the debrief map with the
// route planned from orbit emphasised (before) and the scouted route emphasised (after), same framing.
// Vision: the same 3D view in three layers. Pictures: NASA MRO HiRISE (USGS MSL Gale mosaic and terrain model).
// Run with the dev server on port 5173 (the tile host only allows that origin): node scripts/capture-home.mjs
// Writes mission-vesta/assets/{scout-before,scout-after,vision-*}.jpg and captures.json; then shrink the Vision
// pictures: for f in mission-vesta/assets/vision-*.jpg; do sips --resampleWidth 1600 "$f"; done
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173'
const OUT = new URL('../mission-vesta/assets/', import.meta.url)
// A 16:11 crop of the middle `share` of an element's width, where map.fit and the camera put the route.
async function shot(el, name, share) {
  const b = await el.boundingBox(), w = b.width * share, h = Math.min(b.height, w * 11 / 16)
  const clip = { x: b.x + (b.width - w) / 2, y: b.y + (b.height - h) / 2, width: w, height: h }
  await page.screenshot({ path: new URL(`${name}.jpg`, OUT).pathname, type: 'jpeg', quality: 78, clip })
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chromium', args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// ---- Scout ----
await page.goto(`${BASE}/scout/`)
const suggestions = page.locator('button.f-item')
await suggestions.first().waitFor()
for (let k = 0; k < 3; k++) await suggestions.first().click() // each pick leaves the list
await page.getByRole('button', { name: 'Plan the route' }).click()
while (!(await page.getByRole('button', { name: 'Skip to the end of the flights' }).isVisible())) {
  await page.locator('#f-foot button').last().click()
  await page.waitForTimeout(400)
}
await page.getByRole('button', { name: 'Skip to the end of the flights' }).click()
await page.getByText('Without the scout', { exact: true }).waitFor({ timeout: 90000 })
const map = page.locator('#f-main .f-map')
await page.waitForFunction(() => window.vesta?.app.imagery(), null, { timeout: 60000 }) // HiRISE picture loaded
await page.waitForTimeout(1500)
await page.addStyleTag({ content: '.f-map .cap, .f-map .cap2 { display: none !important }' }) // the home page writes its own captions
const run = await page.evaluate(() => {
  const { app } = window.vesta, route = app.route(), before = app.scout.before()
  return {
    stops: app.stops().filter((s) => s.included).map((s) => s.name),
    orbit: { metres: Math.round(app.describe(before.cells).metres), kj: Math.round(before.energy_j / 1000), rock_cells: before.crossed },
    scouted: { metres: Math.round(app.describe(route.cells).metres), kj: Math.round(route.energy_j / 1000), rock_cells: route.cells.filter(([x, y]) => app.rockSeen(y * app.W + x)).length },
    budget_pct: Math.round((route.energy_j / app.usableJ) * 100),
  }
})
await page.locator('.d-route.old').click()
await page.mouse.move(0, 0)
await page.waitForTimeout(300)
await shot(map, 'scout-before', 0.82)
await page.locator('.d-route.new').click()
await page.mouse.move(0, 0)
await page.waitForTimeout(300)
await shot(map, 'scout-after', 0.82)

// ---- Vision ----
await page.goto(`${BASE}/scout/?vision`)
await page.locator('#layers input').first().waitFor()
await page.waitForFunction(() => window.vesta?.app.imagery(), null, { timeout: 60000 })
await page.waitForTimeout(8000) // detail tiles stream in
const vision = {}
for (const title of ['Imagery', 'Hazards', 'Energy home']) {
  await page.locator('#layers label', { hasText: title }).first().click()
  await page.waitForTimeout(title === 'Imagery' ? 4000 : 1500)
  vision[title] = await page.locator('#layers label', { hasText: title }).first().locator('small').textContent()
  // Hide the map screen's panels for the picture only; the terrain and its colours are untouched.
  await page.addStyleTag({ content: 'body > *:not(#scene) { visibility: hidden !important }' })
  await shot(page.locator('#scene'), `vision-${title.split(' ')[0].toLowerCase()}`, 0.78)
  await page.addStyleTag({ content: 'body > *:not(#scene) { visibility: visible !important }' })
}

writeFileSync(new URL('captures.json', OUT), JSON.stringify({ captured: new Date().toISOString().slice(0, 10), scout: run, vision_sources: vision }, null, 2) + '\n')
console.log(JSON.stringify(run, null, 2))
if (errors.length) console.error('page errors:', errors)
await browser.close()
