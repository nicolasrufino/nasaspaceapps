import { test, expect } from '@playwright/test'

test('opt-in VOI runs in a worker, stops below its value threshold, and leaves the map usable', async ({ page }) => {
  const errors = [], workers = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('worker', (worker) => workers.push(worker.url()))
  await page.goto('/scout/?flags=drone_scout,why_flight,voi')
  // Vision hides the Walk tab since #205; these tests still exercise the shared walk logic, so show it again.
  await page.waitForFunction(() => document.body.classList.contains('vision'))
  await page.evaluate(() => document.body.classList.remove('vision'))
  await expect(page.locator('#route')).toContainText('621 kJ')
  // Read the stop boxes in the click's own JS turn: a fast VOI can land (and re-enable them) before a polled check runs.
  const during = await page.evaluate(() => {
    document.getElementById('scout').click()
    const box = document.querySelector('input[aria-label="Include Altadena drill site in the walk"]')
    return { status: document.getElementById('scoutStatus').textContent, disabled: box.disabled }
  })
  expect(during.status).toContain('Comparing possible flights')
  expect(during.disabled).toBe(true)
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
