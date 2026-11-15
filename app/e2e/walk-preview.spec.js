import { test, expect } from '@playwright/test'

async function preview(page, query = '') {
  await page.goto(`/scout/${query}`)
  await page.waitForFunction(() => window.vesta)
  // Use the public engine bridge to select the five shipped targets; all planning/scouting still runs.
  await page.evaluate(() => {
    for (const s of window.vesta.app.stops()) if (!s.included) window.vesta.app.toggleStop(s.id)
  })
  await page.getByRole('button', { name: 'Plan the route', exact: true }).click()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Next:/ }).click()
  await page.getByRole('button', { name: 'Send the scout', exact: true }).click()
  await page.getByRole('button', { name: 'Skip to the end of the flights', exact: true }).click()
  await page.getByRole('button', { name: 'Review the walk', exact: true }).click({ timeout: 30000 })
  await page.getByRole('button', { name: 'Preview the walk', exact: true }).click({ timeout: 30000 })
}

test('guided preview visits every stop with a visible way to continue and returns to the habitat', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await preview(page)
  const order = await page.evaluate(() => window.vesta.app.route().stops)
  const foot = page.locator('#f-foot')
  for (const id of order) {
    const next = foot.getByRole('button', { name: 'Carry on walking', exact: true })
    await expect(next).toBeVisible({ timeout: 15000 })
    await expect(next).toBeInViewport()
    const state = await page.evaluate(() => {
      const app = window.vesta.app
      return { log: app.scienceLog.map((s) => s.target_id), walking: app.walk.playing(), k: app.walk.state().k }
    })
    expect(state.log.at(-1)).toBe(id)
    expect(state.walking).toBe(false)
    if (id === order[0]) await page.screenshot({ path: testInfo.outputPath('first-stop.png') })
    await expect(page.getByRole('button', { name: 'Read the rock\'s chemistry', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Read the rock\'s chemistry', exact: true }).click()
    await expect(foot.getByRole('button', { name: 'Step', exact: true })).toBeDisabled()
    await next.click()
    await expect.poll(() => page.evaluate(() => window.vesta.app.walk.state().k)).toBeGreaterThan(state.k)
  }
  await expect(page.getByRole('heading', { name: 'Science log', exact: true })).toBeVisible({ timeout: 15000 })
  const end = await page.evaluate(() => {
    const { app } = window.vesta
    return { ...app.walk.state(), walking: app.walk.playing(), log: app.scienceLog.map((s) => s.target_id),
      expectedEnergy: app.meta.energy_budget_j - app.route().energy_j }
  })
  expect(end.k).toBe(end.of)
  expect(end.walking).toBe(false)
  expect(end.energy_left_j).toBeCloseTo(end.expectedEnergy, 5)
  expect(end.log).toEqual(order)
  await page.screenshot({ path: testInfo.outputPath('completed-walk.png') })
  await foot.getByRole('button', { name: 'Restart', exact: true }).last().click()
  await expect(foot.getByRole('button', { name: 'Carry on walking', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.vesta.app.scienceLog.map((s) => s.target_id))).toEqual([order[0]])
  expect(errors).toEqual([])
})

test('automatic preview passes 3%, pauses, seeks without camera drift, restarts, and completes', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await preview(page, '?off=stop_science')
  const foot = page.locator('#f-foot')
  await expect.poll(() => page.evaluate(() => window.vesta.app.walk.state().k)).toBeGreaterThan(4)
  await foot.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await page.evaluate(() => window.vesta.app.walk.state().k)
  await page.waitForTimeout(350)
  expect(await page.evaluate(() => window.vesta.app.walk.state().k)).toBe(paused)
  await foot.getByRole('button', { name: 'Step', exact: true }).click()
  expect(await page.evaluate(() => window.vesta.app.walk.state().k)).toBe(paused + 1)
  const slider = page.getByRole('slider', { name: 'Position along the route' })
  await slider.press('ArrowRight')
  expect(await page.evaluate(() => window.vesta.app.walk.state().k)).toBe(paused + 6)
  const jump = await page.evaluate(() => {
    const { app, walker, controls, camera } = window.vesta
    const before = camera.position.clone().sub(controls.target)
    app.walk.seek(0)
    return { x: walker.position.x, z: walker.position.z, expected: app.meta.base_cell.map((v) => v * app.cs),
      drift: before.distanceTo(camera.position.clone().sub(controls.target)) }
  })
  expect(jump.x).toBeCloseTo(jump.expected[0], 6)
  expect(jump.z).toBeCloseTo(jump.expected[1], 6)
  expect(jump.drift).toBeLessThan(0.001)
  await foot.getByRole('button', { name: 'Restart', exact: true }).click()
  await foot.getByRole('button', { name: 'Walking speed', exact: true }).click()
  await foot.getByRole('button', { name: 'Walking speed', exact: true }).click()
  await expect(foot.getByRole('button', { name: 'Walking speed', exact: true })).toHaveText('4×')
  await expect(page.locator('.d-strip')).toContainText('Arrived back at the habitat.', { timeout: 15000 })
  expect(await page.evaluate(() => window.vesta.app.walk.playing())).toBe(false)
  await foot.getByRole('button', { name: 'Back to the comparison', exact: true }).click()
  await page.getByRole('button', { name: 'Preview the walk', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.vesta.app.walk.state().k)).toBeGreaterThan(4)
  expect(errors).toEqual([])
})

test('flags-off walking keeps the energy model and reset working', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/scout/?world=synthetic&flags=')
  await page.waitForFunction(() => window.vesta)
  await page.getByRole('tab', { name: 'Walk', exact: true }).click()
  await page.getByRole('button', { name: 'Walk', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.vesta.app.walk.state().k)).toBeGreaterThan(4)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const energy = await page.evaluate(() => ({ current: window.appState.energy_left_j, budget: window.vesta.app.meta.energy_budget_j }))
  expect(energy.current).toBeLessThan(energy.budget)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  expect(await page.evaluate(() => window.appState.energy_left_j)).toBe(energy.budget)
  expect(errors).toEqual([])
})
