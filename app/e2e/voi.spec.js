import { test, expect } from '@playwright/test'

test('opt-in VOI runs in a worker, stops below its value threshold, and leaves the map usable', async ({ page }) => {
  const errors = [], workers = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('worker', (worker) => workers.push(worker.url()))
  await page.goto('/scout/?flags=drone_scout,why_flight,voi')
  await expect(page.locator('#route')).toContainText('621 kJ')
  await page.getByRole('button', { name: 'Fly the route', exact: true }).click()
  await expect(page.locator('#scoutStatus')).toContainText('Comparing possible flights')
  await expect(page.getByLabel('Include Altadena drill site in the walk')).toBeDisabled()
  await expect(page.locator('#scoutStatus')).toContainText('No strip clears', { timeout: 60000 })
  await expect(page.locator('#scoutStatus')).toContainText('0 of 3 flights used')
  await expect(page.locator('#scoutStatus')).toContainText('Unscouted ground remains')
  await expect(page.locator('#scoutStatus')).toContainText('not calibrated')
  await expect(page.locator('#route')).toContainText('621 kJ')
  await expect(page.getByLabel('Include Altadena drill site in the walk')).toBeEnabled()
  expect(workers.some((url) => url.includes('scout-voi-worker'))).toBe(true)
  await page.getByRole('tab', { name: 'Walk', exact: true }).click()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('#stats')).toContainText('Margin')
  expect(errors).toEqual([])
})
