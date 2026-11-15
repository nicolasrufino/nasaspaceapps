import { test, expect } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`Scout selection stays clear and operable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/scout/')
    await expect(page.getByRole('heading', { name: 'Choose your stops', exact: true })).toBeVisible()
    const rows = page.locator('.f-stop-list button')
    const go = page.getByRole('button', { name: 'Plan the route', exact: true })
    const all = page.getByRole('button', { name: 'Add all suggested stops', exact: true })
    await expect(rows).toHaveCount(5)
    await expect(go).toBeDisabled()
    await expect(go).toBeInViewport()
    await expect(all).toBeInViewport()
    await expect(rows.first()).toBeInViewport()

    // The science is available on demand, with its original source links.
    const goal = page.locator('.f-goal details')
    await expect(goal).not.toHaveAttribute('open', '')
    await goal.locator('summary').click()
    await expect(goal.getByRole('link', { name: 'NASA ↗' })).toHaveCount(3)
    await expect(goal.locator('.f-item').filter({ hasText: /^Fractures/ })).toBeVisible()
    await goal.locator('summary').click()

    // Repainting selection must preserve keyboard focus and permit undo.
    await rows.first().focus()
    await rows.first().press('Enter')
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(rows.first()).toBeFocused()
    await rows.first().press('Space')
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'false')
    await all.click()
    await expect(all).toBeDisabled()
    await expect(page.locator('.f-stop-list [aria-pressed=true]')).toHaveCount(5)
    await rows.nth(4).click()
    await rows.nth(3).click()
    await expect(go).toBeEnabled()
    await rows.nth(2).click()
    await expect(go).toBeDisabled()
    await rows.nth(2).click()
    await page.getByRole('button', { name: 'Shortest', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Shortest', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await go.click()
    await expect(page.getByRole('heading', { name: 'A straight line is not enough' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next: Terrain', exact: true })).toBeInViewport()
    await page.getByRole('button', { name: '1 Stops', exact: true }).click()
    await expect(page.locator('.f-stop-list [aria-pressed=true]')).toHaveCount(3)
    await expect(go).toBeInViewport()
    expect(errors).toEqual([])
  })
}
