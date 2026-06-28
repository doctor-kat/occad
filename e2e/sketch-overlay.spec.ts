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
    // This creates "Sketch 1" on the Front Plane. The Rectangle tool is a
    // split-button group whose body is labelled "Corner Rectangle".
    const rectangleOperation = page.locator('button').filter({ hasText: /^Corner Rectangle$/ });
    await rectangleOperation.click();

    // Verify sketch mode is active. (We assert on the "Finish Sketch" control
    // rather than the feature tree's "Sketch 1" row, because entering a sketch
    // auto-switches the sidebar to the entity list, hiding the feature tree.)
    await expect(page.getByText('Finish Sketch')).toBeVisible({ timeout: 20000 });

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

  test('H toggles grid visibility independent of G grid-snap', async ({ page }) => {
    // Enter sketch mode on the Front Plane.
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await page.getByText('Front Plane').click();
    await page.getByRole('tab', { name: 'Sketch' }).click();
    await page.locator('button').filter({ hasText: /^Corner Rectangle$/ }).click();
    await expect(page.getByText('Finish Sketch')).toBeVisible({ timeout: 20000 });

    // The sketcher hotkeys panel reflects the live state of both toggles.
    await expect(page.getByText(/Show Grid: ON/)).toBeVisible();
    await expect(page.getByText(/Grid Snap: ON/)).toBeVisible();

    // H hides the grid but must NOT touch snapping.
    await page.keyboard.press('h');
    await expect(page.getByText(/Show Grid: OFF/)).toBeVisible();
    await expect(page.getByText(/Grid Snap: ON/)).toBeVisible();

    // G toggles snapping but must NOT touch grid visibility.
    await page.keyboard.press('g');
    await expect(page.getByText(/Grid Snap: OFF/)).toBeVisible();
    await expect(page.getByText(/Show Grid: OFF/)).toBeVisible();

    // H again restores the grid, snapping still off — fully independent.
    await page.keyboard.press('h');
    await expect(page.getByText(/Show Grid: ON/)).toBeVisible();
    await expect(page.getByText(/Grid Snap: OFF/)).toBeVisible();
  });
});
