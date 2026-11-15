import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fixturePixels } from './terrain-fixture.mjs'
const reference = JSON.parse(readFileSync(new URL('./terrain-reference.json', import.meta.url)))

async function choosePhoto(page, size = 256) {
  const base64 = await page.evaluate(({ pixels, size }) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), 256, 256), 0, 0)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { pixels: Array.from(fixturePixels()), size })
  await page.locator('#terrainPhoto').setInputFiles({ name: 'runtime-parity.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
}

test('flags off keeps the map usable and fetches no classifier assets', async ({ page }) => {
  const assets = [], errors = []
  page.on('request', (r) => { if (/\.onnx|\.wasm|terrain-worker|terrain-runner/.test(r.url())) assets.push(r.url()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/scout/?world=synthetic&flags=')
  await expect(page.locator('#title')).toContainText('cells')
  await page.getByRole('tab', { name: 'Walk', exact: true }).click()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('#terrainClassifier')).toHaveCount(0)
  expect(assets).toEqual([])
  expect(errors).toEqual([])
})

test('real WASM inference matches CPU reference; invalid files and failed loads recover', async ({ page }) => {
  const errors = [], assets = [], requests = [], logits = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }))
  page.on('response', (r) => { if (/\.onnx(?:\?|$)/.test(r.url())) assets.push(r) })
  // Observe the actual worker output without replacing inference or injecting a result.
  await page.exposeFunction('recordTerrainOutput', (data) => { if (data.logits) logits.push(data.logits) })
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); this.addEventListener('message', (e) => window.recordTerrainOutput(e.data)) }
    }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/scout/?world=gale&flags=classifier,science_stop,step_mode')
  await expect(page.locator('#title')).toContainText('cells')
  await page.getByRole('tab', { name: 'Walk', exact: true }).click()
  await page.locator('#terrainClassifier summary').click()
  await choosePhoto(page, 128)
  await expect(page.locator('#terrainStatus')).toContainText('at least 256')
  await expect(page.locator('#terrainAnalyze')).toBeDisabled()
  await choosePhoto(page)
  await expect(page.locator('#terrainPreview')).toBeVisible()
  expect(assets).toEqual([]) // still lazy, even with a photo selected
  await page.route(/\.onnx(?:\?|$)/, (route) => route.fulfill({ status: 503, body: 'Temporary test failure' }), { times: 1 })
  await page.locator('#terrainAnalyze').click()
  await expect(page.locator('#terrainStatus')).toContainText('Model download failed (503)', { timeout: 90000 })
  await expect(page.locator('#terrainResult')).toBeEmpty()
  await page.locator('#terrainAnalyze').click()
  await expect(page.locator('#terrainStatus')).toContainText('Analysis complete', { timeout: 90000 })
  await expect(page.locator('#terrainResult')).toContainText(`Predicted dominant surface: ${reference.predicted_name}`)
  expect(logits).toHaveLength(1)
  logits[0].forEach((value, i) => expect(Math.abs(value - reference.logits[i])).toBeLessThan(0.001))
  const modelResponse = assets.find((r) => r.status() === 200)
  expect(createHash('sha256').update(await modelResponse.body()).digest('hex')).toBe(reference.model_sha256)
  expect(requests.every((r) => r.method === 'GET')).toBeTruthy() // photo was never uploaded
  const expectedOrigin = new URL(page.url()).origin
  expect(requests.filter((r) => /\.onnx|\.wasm/.test(r.url)).every((r) => new URL(r.url).origin === expectedOrigin)).toBeTruthy()
  await page.locator('#terrainPreview').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#terrainResult')).toBeEmpty()
  await page.locator('#terrainAnalyze').click()
  // Replace the photo while the result is pending: old result must not be attributed to it.
  await choosePhoto(page, 128)
  await expect(page.locator('#terrainStatus')).toContainText('at least 256')
  await expect(page.locator('#terrainResult')).toBeEmpty()
  await expect.poll(() => logits.length).toBe(2)
  expect(errors).toEqual([])
  await page.goto('about:blank') // exercises pagehide worker cleanup before browser teardown
})
