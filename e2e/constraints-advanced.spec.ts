import { test, expect, type Page } from '@playwright/test';

/**
 * e2e for the remaining constraint types (tangent, angle, coincident, distance) and
 * the constraint-list delete. Asserts the real UI → createConstraint → addConstraint
 * path produces the correct planegcs objects, and removeConstraint deletes them.
 *
 * (The geometric *solve* for every kind is covered by the real-solver unit tests in
 * constraintFactory.test.ts; line + radius geometry round-trips are covered by the
 * other e2e specs. These disjoint multi-entity sketches don't form one wire, so DOF
 * is not asserted here.)
 *
 * Selection is driven through the viewport store (canvas picking is non-deterministic
 * in the perspective view).
 */

const SKETCH_ID = 'seed-adv-1';
const WORKPLANE = {
  origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 }, yAxis: { x: 0, y: 1, z: 0 },
};
const ELEMENTS = [
  { type: 'line', id: 'L1', start: { x: -30, y: 0 }, end: { x: 0, y: 0 } },
  { type: 'line', id: 'L2', start: { x: 10, y: 5 }, end: { x: 30, y: 30 } },
  { type: 'circle', id: 'C', center: { x: 50, y: 0 }, radius: 8 },
];
const PRIMITIVES = [
  { id: 'A', type: 'point', fixed: false, data: { x: -30, y: 0 } },
  { id: 'B', type: 'point', fixed: false, data: { x: 0, y: 0 } },
  { id: 'L1', type: 'line', fixed: false, data: { p1_id: 'A', p2_id: 'B' } },
  { id: 'E', type: 'point', fixed: false, data: { x: 10, y: 5 } },
  { id: 'D', type: 'point', fixed: false, data: { x: 30, y: 30 } },
  { id: 'L2', type: 'line', fixed: false, data: { p1_id: 'E', p2_id: 'D' } },
  { id: 'CC', type: 'point', fixed: false, data: { x: 50, y: 0 } },
  { id: 'C', type: 'circle', fixed: false, data: { c_id: 'CC', radius: 8 } },
];
const REFERENCE_GEOMETRY = [
  { id: 'front-plane', name: 'Front Plane', type: 'plane', isVisible: false },
  { id: 'top-plane', name: 'Top Plane', type: 'plane', isVisible: false },
  { id: 'right-plane', name: 'Right Plane', type: 'plane', isVisible: false },
  { id: 'origin', name: 'Origin', type: 'origin', isVisible: false },
];

async function seed(page: Page, constraints: any[] = []) {
  await page.evaluate(({ sketchId, workplane, elements, primitives, referenceGeometry, constraints }) => {
    const now = Date.now();
    const project = {
      id: 'e2e-adv', name: 'Untitled Project', createdAt: now, updatedAt: now, version: 2,
      referenceGeometry,
      sketches: [{
        id: sketchId, name: 'Sketch 1', workplane, elements, primitives, constraints,
        visualMetadata: {}, isClosed: false, isVisible: true, createdAt: now, updatedAt: now,
      }],
      features: [],
    };
    window.localStorage.setItem('occad-project', JSON.stringify(project));
  }, { sketchId: SKETCH_ID, workplane: WORKPLANE, elements: ELEMENTS, primitives: PRIMITIVES, referenceGeometry: REFERENCE_GEOMETRY, constraints });
}

async function enterSketch(page: Page) {
  await expect(page.locator('.tree-item-row').getByText('Sketch 1')).toBeVisible({ timeout: 15000 });
  await page.locator('.tree-item-row', { hasText: 'Sketch 1' }).hover();
  await page.getByTestId(`edit-${SKETCH_ID}`).click();
  await expect(page.getByTestId('constraint-toolbar')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function setValue(page: Page, v: string) {
  await page.getByTestId('constraint-value').fill(v);
}

async function applyWithSelection(page: Page, key: string, ids: string[]) {
  const btn = page.locator(`button[data-constraint="${key}"]`);
  await expect(async () => {
    await page.evaluate((ids) => {
      (window as any).__viewportStore.getState().setSketchElementSelection(ids);
    }, ids);
    await btn.click({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 1', { timeout: 10000 });
}

async function persistedConstraint(page: Page) {
  return page.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem('occad-project') || '{}');
    return (raw.sketches?.[0]?.constraints ?? [])[0];
  });
}

test.describe('Sketch advanced constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('Tangent (line + circle)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await applyWithSelection(page, 'tangent', ['L1', 'C']);
    expect(await persistedConstraint(page)).toMatchObject({ type: 'tangent_lc', l_id: 'L1', c_id: 'C' });
  });

  test('Angle (two lines)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await setValue(page, '45');
    await applyWithSelection(page, 'angle', ['L1', 'L2']);
    const c = await persistedConstraint(page);
    expect(c).toMatchObject({ type: 'l2l_angle_ll', l1_id: 'L1', l2_id: 'L2' });
    expect(Math.round((c.angle * 180) / Math.PI)).toBe(45);
  });

  test('Coincident (two points)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await applyWithSelection(page, 'coincident', ['B', 'E']);
    expect(await persistedConstraint(page)).toMatchObject({ type: 'p2p_coincident', p1_id: 'B', p2_id: 'E' });
  });

  test('Distance (two points)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await setValue(page, '25');
    await applyWithSelection(page, 'distance', ['B', 'E']);
    expect(await persistedConstraint(page)).toMatchObject({ type: 'p2p_distance', p1_id: 'B', p2_id: 'E', distance: 25 });
  });

  test('Horizontal Distance (two points)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await setValue(page, '25');
    await applyWithSelection(page, 'horizontal-distance', ['B', 'E']);
    expect(await persistedConstraint(page)).toMatchObject({
      type: 'difference', param1: { o_id: 'B', prop: 'x' }, param2: { o_id: 'E', prop: 'x' }, difference: 25,
    });
  });

  test('Vertical Distance (two points)', async ({ page }) => {
    await seed(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);
    await setValue(page, '25');
    await applyWithSelection(page, 'vertical-distance', ['B', 'E']);
    expect(await persistedConstraint(page)).toMatchObject({
      type: 'difference', param1: { o_id: 'B', prop: 'y' }, param2: { o_id: 'E', prop: 'y' }, difference: 25,
    });
  });

  test('delete removes a constraint from the list', async ({ page }) => {
    await seed(page, [{ id: 'cx', type: 'horizontal_l', l_id: 'L1' }]);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    await enterSketch(page);

    await expect(page.getByTestId('constraint-list')).toBeVisible();
    await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 1');
    await page.getByTestId('constraint-delete-cx').click();
    await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 0', { timeout: 10000 });
    await expect(page.getByTestId('constraint-list')).toHaveCount(0);
  });
});
