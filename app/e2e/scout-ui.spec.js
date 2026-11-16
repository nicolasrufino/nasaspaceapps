import { test, expect } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`Scout stage 1 stays clear and operable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/scout/')
    await expect(page.getByRole('heading', { name: 'Pick a science goal', exact: true })).toBeVisible()
    const water = page.getByRole('button', { name: /^Groundwater/ })
    const box = page.getByRole('button', { name: /^Boxwork/ })
    const rows = page.locator('.f-stops .f-item')
    const go = page.getByRole('button', { name: 'Plan the route', exact: true })
    await expect(rows).toHaveCount(0)
    await expect(go).toBeDisabled()
    await expect(go).toBeInViewport()

    // A goal adds its stops at once, and the list and the main action stay on screen without scrolling.
    await water.click()
    await expect(water).toHaveAttribute('aria-pressed', 'true')
    await expect(rows).toHaveCount(5)
    await expect(rows.last()).toBeInViewport()
    await expect(go).toBeEnabled()
    await rows.first().getByRole('button', { name: /^Remove/ }).click()
    await rows.first().getByRole('button', { name: /^Remove/ }).click()
    await rows.first().getByRole('button', { name: /^Remove/ }).click()
    await expect(rows).toHaveCount(2)
    await expect(go).toBeDisabled()
    await expect(page.getByText('Add 1 more stop', { exact: true })).toBeVisible()

    // Switching goal swaps the stops; picking the goal again restores its full set.
    await expect(box).toBeEnabled()
    await box.click()
    await expect(box).toHaveAttribute('aria-pressed', 'true')
    await expect(rows.first()).toContainText('Site A')
    await water.click()
    await expect(rows).toHaveCount(5)

    await go.click()
    await expect(page.getByRole('heading', { name: 'A straight line is not enough' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next: Terrain', exact: true })).toBeInViewport()
    await page.getByRole('button', { name: '1 Stops', exact: true }).click()
    await expect(rows).toHaveCount(5)
    await expect(water).toHaveAttribute('aria-pressed', 'true')
    await expect(go).toBeInViewport()
    expect(errors).toEqual([])
  })
}
