import { test, expect } from '@playwright/test';
import { drawSketchPointsUntil, sketchHasElementOfType } from './helpers';

/**
 * Real end-to-end coverage for the sketch-primitive tools finished in this pass:
 * Perimeter (3-point) Circle, Centerpoint Arc and Tangent Arc. Each test drives
 * the actual UI — selects a plane, picks the tool from its split-button group,
 * draws on the canvas — and asserts the expected element was committed to the
 * persisted sketch. The arc/circle math itself is unit-tested in
 * src/cad/engine/sketch/arcGeometry.test.ts; these specs prove the tools are
 * wired through the overlay and reach state.
 */
test.describe('Sketch primitive tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 15000 });
  });

  /** Select the Front Plane and pick a tool from its group dropdown (enters sketch mode). */
  async function startTool(page: import('@playwright/test').Page, caret: string, item: string) {
    await page.getByText('Front Plane').click();
    await page.getByRole('tab', { name: 'Sketch' }).click();
    // Open the split-button group caret, then pick the variant.
    await page.getByRole('button', { name: caret }).click();
    await page.getByRole('menuitem', { name: item }).click();
    // Sketch mode is active once the Finish Sketch button shows.
    await expect(page.getByRole('button', { name: 'Finish Sketch' })).toBeVisible({ timeout: 20000 });
  }

  test('Perimeter Circle creates a circle from three points', async ({ page }) => {
    test.setTimeout(60000);
    await startTool(page, 'Circle options', 'Perimeter Circle');

    await drawSketchPointsUntil(
      page,
      [{ dx: -60, dy: 0 }, { dx: 0, dy: -60 }, { dx: 60, dy: 0 }],
      () => sketchHasElementOfType(page, 'circle'),
      { label: 'perimeter circle' }
    );

    expect(await sketchHasElementOfType(page, 'circle')).toBe(true);
  });

  test('Centerpoint Arc creates an arc from center/start/end', async ({ page }) => {
    test.setTimeout(60000);
    await startTool(page, '3 Point Arc options', 'Centerpoint Arc');

    await drawSketchPointsUntil(
      page,
      [{ dx: 0, dy: 0 }, { dx: 60, dy: 0 }, { dx: 0, dy: -60 }],
      () => sketchHasElementOfType(page, 'arc'),
      { label: 'centerpoint arc' }
    );

    // The committed arc carries solved center/radius/angle geometry.
    const arc = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('occad-project') || '{}');
      for (const s of p.sketches || []) {
        for (const e of s.elements || []) if (e.type === 'arc') return e;
      }
      return null;
    });
    expect(arc).not.toBeNull();
    expect(typeof arc.radius).toBe('number');
    expect(typeof arc.startAngle).toBe('number');
    expect(typeof arc.endAngle).toBe('number');
    expect(arc.endAngle).toBeGreaterThan(arc.startAngle);
  });

  test('Tangent Arc creates an arc from two points', async ({ page }) => {
    test.setTimeout(60000);
    await startTool(page, '3 Point Arc options', 'Tangent Arc');

    await drawSketchPointsUntil(
      page,
      [{ dx: -50, dy: 0 }, { dx: 50, dy: -50 }],
      () => sketchHasElementOfType(page, 'arc'),
      { label: 'tangent arc' }
    );

    expect(await sketchHasElementOfType(page, 'arc')).toBe(true);
  });
});
