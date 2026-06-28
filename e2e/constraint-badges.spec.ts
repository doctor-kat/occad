import { test, expect, type Page } from '@playwright/test';
import { drawClosedRectangle } from './helpers';

/**
 * E2e for the in-viewport constraint badges: each constraint shows as a small
 * clickable DOM square above its entity midpoint, and clicking it selects the
 * constraint (highlighting its row in the constraint list). A corner rectangle's
 * 4 auto-constraints (2 horizontal + 2 vertical) give us 4 badges to drive.
 */
function selectedConstraintId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__viewportStore.getState().selectedConstraintId);
}

test.describe('Constraint badges', () => {
  test('badges render and clicking one selects the constraint', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await page.getByText('Front Plane').click();
    await page.getByRole('tab', { name: 'Sketch' }).click();
    const rectTool = page.locator('button').filter({ hasText: /^Corner Rectangle$/ });
    await rectTool.click();
    await expect(page.getByText('Finish Sketch')).toBeVisible({ timeout: 20000 });

    await drawClosedRectangle(page);

    // Toggle the draw tool off → selection mode, where badges render.
    await rectTool.click();

    const badges = page.locator('[data-testid^="constraint-badge-"]');
    await expect(badges).toHaveCount(4);
    await expect(badges.first()).toBeVisible();

    // Click a badge → its constraint becomes selected, and its list row highlights.
    const firstBadge = badges.first();
    const testid = await firstBadge.getAttribute('data-testid');
    const constraintId = testid!.replace('constraint-badge-', '');

    await firstBadge.click();
    expect(await selectedConstraintId(page)).toBe(constraintId);
    await expect(page.getByTestId(`constraint-row-${constraintId}`)).toHaveAttribute('data-selected', 'true');

    // Clicking again deselects.
    await firstBadge.click();
    expect(await selectedConstraintId(page)).toBeNull();
  });
});
