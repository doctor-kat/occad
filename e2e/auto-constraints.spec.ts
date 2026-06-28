import { test, expect } from '@playwright/test';
import { drawClosedRectangle } from './helpers';

/**
 * E2e: a freshly drawn corner rectangle ships with auto-constraints (SolidWorks
 * "sketch relations") — two Horizontal + two Vertical — that round-trip through
 * the real planegcs solver and persist on the sketch.
 */
test.describe('Rectangle auto-constraints', () => {
  test('a corner rectangle gains 2 horizontal + 2 vertical relations', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await page.getByText('Front Plane').click();
    await page.getByRole('tab', { name: 'Sketch' }).click();
    await page.locator('button').filter({ hasText: /^Corner Rectangle$/ }).click();
    await expect(page.getByText('Finish Sketch')).toBeVisible({ timeout: 20000 });

    await drawClosedRectangle(page);

    // The solver round-trip persists the inferred constraints onto the sketch.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('occad-project') || '{}');
            const sketch = (p.sketches || []).find((s: any) => (s.elements || []).length > 0);
            const auto = (sketch?.constraints || []).filter((c: any) => c.auto);
            return {
              total: auto.length,
              horizontal: auto.filter((c: any) => c.type === 'horizontal_l').length,
              vertical: auto.filter((c: any) => c.type === 'vertical_l').length,
            };
          }),
        { timeout: 15000, message: 'rectangle should gain 4 auto H/V constraints' },
      )
      .toEqual({ total: 4, horizontal: 2, vertical: 2 });
  });
});
