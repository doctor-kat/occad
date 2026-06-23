import { test, expect, type Page } from '@playwright/test';

/**
 * e2e for the Radius constraint on a circle: select a circle, enter a value, apply.
 * Exercises the full path — UI → createConstraint → addConstraint → buildSketch →
 * planegcs solve → solved sketch back to the UI — and asserts the solver actually
 * drove the circle radius from 10 → 40.
 *
 * Selection is driven through the viewport store (canvas picking is non-deterministic
 * in the perspective view); the constraint application, solve, and UI are real.
 */

const SKETCH_ID = 'seed-circle-1';

const WORKPLANE = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

const ELEMENTS = [{ type: 'circle', id: 'CIRC', center: { x: 0, y: 0 }, radius: 10 }];
const PRIMITIVES = [
  { id: 'CIRC_center', type: 'point', fixed: false, data: { x: 0, y: 0 } },
  { id: 'CIRC', type: 'circle', fixed: false, data: { c_id: 'CIRC_center', radius: 10 } },
];
const REFERENCE_GEOMETRY = [
  { id: 'front-plane', name: 'Front Plane', type: 'plane', isVisible: false },
  { id: 'top-plane', name: 'Top Plane', type: 'plane', isVisible: false },
  { id: 'right-plane', name: 'Right Plane', type: 'plane', isVisible: false },
  { id: 'origin', name: 'Origin', type: 'origin', isVisible: false },
];

async function seedProject(page: Page) {
  await page.evaluate(({ sketchId, workplane, elements, primitives, referenceGeometry }) => {
    const now = Date.now();
    const project = {
      id: 'e2e-circle', name: 'Untitled Project', createdAt: now, updatedAt: now, version: 2,
      referenceGeometry,
      sketches: [{
        id: sketchId, name: 'Sketch 1', workplane, elements, primitives, constraints: [],
        visualMetadata: {}, isClosed: true, isVisible: true, createdAt: now, updatedAt: now,
      }],
      features: [],
    };
    window.localStorage.setItem('occad-project', JSON.stringify(project));
  }, { sketchId: SKETCH_ID, workplane: WORKPLANE, elements: ELEMENTS, primitives: PRIMITIVES, referenceGeometry: REFERENCE_GEOMETRY });
}

test.describe('Sketch circle constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await seedProject(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
  });

  test('Radius applies a circle_radius constraint via c_id', async ({ page }) => {
    await expect(page.locator('.tree-item-row').getByText('Sketch 1')).toBeVisible({ timeout: 15000 });
    await page.locator('.tree-item-row', { hasText: 'Sketch 1' }).hover();
    await page.getByTestId(`edit-${SKETCH_ID}`).click();

    await expect(page.getByTestId('constraint-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Set the radius value
    const valueInput = page.getByTestId('constraint-value');
    await valueInput.fill('40');

    // Select the circle and apply Radius (re-set selection in case a re-render clears it)
    const radiusBtn = page.locator('button[data-constraint="radius"]');
    await expect(async () => {
      await page.evaluate((ids) => {
        (window as any).__viewportStore.getState().setSketchElementSelection(ids);
      }, ['CIRC']);
      await radiusBtn.click({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 1', { timeout: 10000 });
    // Solver ran end-to-end: DOF readout is populated with a number
    await expect(page.getByTestId('sketch-dof')).not.toHaveText('DOF: —', { timeout: 10000 });

    // The persisted constraint is the correct planegcs object built by createConstraint,
    // referencing the circle via `c_id` and carrying the value from the toolbar input.
    const constraint = await page.evaluate(() => {
      const raw = JSON.parse(window.localStorage.getItem('occad-project') || '{}');
      return (raw.sketches?.[0]?.constraints ?? [])[0];
    });
    expect(constraint).toMatchObject({ type: 'circle_radius', c_id: 'CIRC', radius: 40 });

    // The solver actually changed the circle radius from 10 → 40 (circle reached the solver).
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const raw = JSON.parse(window.localStorage.getItem('occad-project') || '{}');
        const circ = (raw.sketches?.[0]?.primitives ?? []).find((p: any) => p.id === 'CIRC');
        return Math.round(circ?.data?.radius ?? 0);
      });
    }, { timeout: 10000 }).toBe(40);
  });
});
