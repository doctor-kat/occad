import { test, expect, type Page } from '@playwright/test';
import { drawClosedRectangle } from './helpers';

/**
 * E2E for context-sensitive sketch selection: SolidWorks-style box (drag right →
 * window / fully enclosed) and crossing (drag left → touching) rubber-band select
 * of sketch entities, plus the live sidebar entity list reflecting the selection.
 *
 * Box-select reads raw screen px (not the plane's move-only raycaster), so unlike
 * the drawing helpers it doesn't need a warmup — but the drawing of the seed
 * rectangle still goes through the shared, retry-hardened helper.
 */

/** Read the current sketch selection set from the exposed viewport store. */
function selectedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__viewportStore.getState().selectedSketchElementIds);
}

/** Perform a left-button drag between two canvas-relative points. */
async function boxDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> {
  await page.mouse.move(from.x, from.y, { steps: 4 });
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test.describe('Sketch box / crossing selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // Enter sketch mode on the front plane with the Corner Rectangle tool, then
    // draw one rectangle.
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await page.getByText('Front Plane').click();
    await page.getByRole('tab', { name: 'Sketch' }).click();
    const rectTool = page.locator('button').filter({ hasText: /^Corner Rectangle$/ });
    await rectTool.click();
    // Sketch mode is ready once the overlay's Finish Sketch control is shown.
    // (The feature tree's "Sketch 1" row is hidden here because entering a sketch
    // auto-switches the sidebar to the entity list.)
    await expect(page.getByText('Finish Sketch')).toBeVisible({ timeout: 20000 });

    await drawClosedRectangle(page);

    // Toggle the active draw tool off → sketch SELECTION mode (still in the sketch,
    // but the left button now drives box-select rather than drawing).
    await rectTool.click();
    await page.waitForTimeout(200);
  });

  test('sidebar lists the sketch entity while editing', async ({ page }) => {
    // Entering sketch mode auto-switches the sidebar to the entity list.
    await expect(page.getByTestId('sketch-entities-panel')).toBeVisible();
    await expect(page.getByText('Rectangle 1')).toBeVisible();
  });

  test('window select (drag right) selects a fully-enclosed entity', async ({ page }) => {
    const b = await page.locator('canvas').first().boundingBox();
    if (!b) throw new Error('no canvas');
    const cx = b.x + b.width * 0.5;
    const cy = b.y + b.height * 0.6; // matches drawClosedRectangle's centre

    // Drag right, enclosing the whole rectangle (rect spans ~[cx-40,cx+50]×[cy-30,cy+30]).
    await boxDrag(page, { x: cx - 90, y: cy - 80 }, { x: cx + 100, y: cy + 80 });

    expect(await selectedIds(page)).toHaveLength(1);

    // The sidebar row reflects the selection.
    const rows = page.locator('[data-testid^="sketch-entity-"][data-selected="true"]');
    await expect(rows).toHaveCount(1);
  });

  test('window select that only partially overlaps selects nothing', async ({ page }) => {
    const b = await page.locator('canvas').first().boundingBox();
    if (!b) throw new Error('no canvas');
    const cx = b.x + b.width * 0.5;
    const cy = b.y + b.height * 0.6;

    // Drag right, but the right edge stops inside the rectangle → not fully enclosed.
    await boxDrag(page, { x: cx - 90, y: cy - 80 }, { x: cx + 10, y: cy + 80 });

    expect(await selectedIds(page)).toHaveLength(0);
  });

  test('crossing select (drag left) selects a merely-touched entity', async ({ page }) => {
    const b = await page.locator('canvas').first().boundingBox();
    if (!b) throw new Error('no canvas');
    const cx = b.x + b.width * 0.5;
    const cy = b.y + b.height * 0.6;

    // Same partial region as the negative window test, but dragged LEFT → crossing,
    // which should select the entity it overlaps.
    await boxDrag(page, { x: cx + 10, y: cy + 80 }, { x: cx - 90, y: cy - 80 });

    expect(await selectedIds(page)).toHaveLength(1);
  });
});
