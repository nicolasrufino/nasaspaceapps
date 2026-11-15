import { test, expect } from '@playwright/test'

test('Gale scouts three times, replans, and has no Walk tab in Vision, without runtime errors', async ({ page }) => {
  const errors = [], requests = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/scout/?vision')
  await expect(page.locator('#route')).toContainText('621 kJ')
  await page.getByRole('button', { name: 'Fly the route', exact: true }).click()
  await expect(page.locator('#scoutStatus')).toContainText('Flight 1 of 3')
  await expect(page.getByLabel('Include Altadena drill site in the walk')).toBeDisabled()
  await expect(page.locator('#scoutStatus')).toContainText('Flight 2 of 3', { timeout: 30000 })
  await expect(page.locator('#route')).toContainText('629 kJ')
  await expect(page.locator('#scoutStatus')).toContainText('3 of 3 flights used', { timeout: 45000 })
  await expect(page.locator('#scoutStatus')).toContainText('44 rock cells found')
  await expect(page.locator('#scoutStatus')).toContainText('fully scouted')
  await expect(page.locator('#route')).toContainText('630 kJ')
  await expect(page.locator('#scout')).toBeDisabled()
  await expect(page.locator('#flightLog li')).toHaveCount(3)
  await expect(page.locator('#flightLog li').nth(0)).toContainText('+8.0 kJ; 5 newly found route cells avoided')
  await expect(page.locator('#flightLog li').nth(1)).toContainText('+1.1 kJ; 3 newly found route cells avoided')
  await expect(page.locator('#flightLog li').nth(2)).toContainText('0.0 kJ; 0 newly found route cells avoided')
  expect(requests.some((url) => url.includes('scout_plan.json'))).toBe(false)
  expect(requests.some((url) => url.includes('scout-voi-worker'))).toBe(false)
  // Vision has no Walk tab since #205 (the guided flow's walk preview is covered by walk-preview.spec.js).
  await expect(page.getByRole('tab', { name: 'Walk', exact: true })).toBeHidden()
  expect(errors).toEqual([])
})
