import { Page, expect } from '@playwright/test';

/**
 * Draw a closed rectangle on the active sketch plane and verify it registered.
 *
 * Why this is more than two clicks: the sketch plane is an R3F mesh that only
 * raycasts on *pointer-move* events, so a bare `mouse.click()` with no preceding
 * movement is frequently dropped in headless Chromium (a real user always moves
 * the mouse before clicking). We therefore warm the pointer up, hover before each
 * click, then assert the sketch actually gained a closed element — retrying the
 * whole gesture a few times to absorb the residual WebGL/event timing jitter.
 *
 * The underlying app bug this guards against (the second click being silently
 * dropped after the first point was placed) is fixed in SketchOverlay; this
 * helper just makes the gesture deterministic in CI.
 */
export async function drawClosedRectangle(
  page: Page,
  opts: { cxFrac?: number; cyFrac?: number; attempts?: number } = {}
): Promise<void> {
  const { cxFrac = 0.5, cyFrac = 0.6, attempts = 4 } = opts;
  const canvas = page.locator('canvas').first();

  const hasClosedSketch = () =>
    page.evaluate(() => {
      try {
        const p = JSON.parse(localStorage.getItem('occad-project') || '{}');
        return (p.sketches || []).some(
          (s: any) => s.isClosed && (s.elements || []).length > 0
        );
      } catch {
        return false;
      }
    });

  for (let attempt = 0; attempt < attempts; attempt++) {
    const b = await canvas.boundingBox();
    if (!b) throw new Error('drawClosedRectangle: canvas has no bounding box');
    const cx = b.x + b.width * cxFrac;
    const cy = b.y + b.height * cyFrac;

    // Warm up R3F's raycaster with real pointer movement over the plane.
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx - 70 + i * 25, cy - 10 + (i % 2) * 20, { steps: 4 });
      await page.waitForTimeout(80);
    }
    // Corner 1: hover (so the click lands on the plane), then click.
    await page.mouse.move(cx - 40, cy - 30, { steps: 6 });
    await page.waitForTimeout(250);
    await page.mouse.click(cx - 40, cy - 30);
    await page.waitForTimeout(300);
    // Corner 2.
    await page.mouse.move(cx + 50, cy + 30, { steps: 6 });
    await page.waitForTimeout(250);
    await page.mouse.click(cx + 50, cy + 30);
    await page.waitForTimeout(300);

    if (await hasClosedSketch()) return;

    // Clear any half-placed point before retrying.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  // One explicit assertion so a genuine failure reports clearly.
  expect(await hasClosedSketch(), 'rectangle did not produce a closed sketch').toBe(true);
}
