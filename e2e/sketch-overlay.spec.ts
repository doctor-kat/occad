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
  });

  test('should enter sketch mode without R3F namespace errors', async ({ page }) => {
    // Wait for the app to load - check that the FeatureTree shows expected items
    await page.waitForSelector('text=Sketch1', { timeout: 10000 });
    await page.waitForSelector('text=Boss-Extrude1', { timeout: 5000 });

    // Click "Sketch1" in the FeatureTree to select it
    await page.click('text=Sketch1');

    // Wait a moment for the selection to register and UI to update
    await page.waitForTimeout(500);

    // Find the edit button - it should be visible in the Sketch1 row
    // The edit button has a PencilSimple icon and appears after selection
    const sketch1Row = page.locator('.tree-item-row', { has: page.locator('text=Sketch1') });
    const editButton = sketch1Row.locator('button').filter({ has: page.locator('svg') }).nth(2); // Third button (visibility, expand/collapse, edit)
    await editButton.click({ timeout: 10000 });

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
