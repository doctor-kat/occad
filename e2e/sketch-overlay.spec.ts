import { test, expect, type Page } from '@playwright/test';

test.describe('SketchOverlay', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Collect console errors during the session
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test('should enter sketch mode without R3F namespace errors', async ({ page }) => {
    // Wait for the app to load - Front Plane should always be there
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });

    // Select a plane to sketch on — sketch tools no longer auto-pick the front
    // plane; they require a plane (or face) to be selected first.
    await page.getByText('Front Plane').click();

    // Switch to Sketch tab
    await page.getByRole('tab', { name: 'Sketch' }).click();

    // Click a sketch operation to start a new sketch on the selected plane.
    // This creates "Sketch 1" on the Front Plane.
    const rectangleOperation = page.locator('button').filter({ hasText: /^Rectangle$/ });
    await rectangleOperation.click();

    // Verify Sketch 1 appears in Feature Tree
    await expect(page.getByText('Sketch 1').first()).toBeVisible({ timeout: 20000 });

    // Wait for SketchOverlay to render
    await page.waitForTimeout(2000);

    // Assert no R3F namespace errors occurred
    const r3fErrors = consoleErrors.filter(err =>
      err.includes('not part of the THREE namespace')
    );

    expect(r3fErrors).toHaveLength(0);

    // If errors occurred, log them for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
  });
});
