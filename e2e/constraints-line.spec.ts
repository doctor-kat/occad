import { test, expect, type Page } from '@playwright/test';

/**
 * e2e for geometric line constraints. Exercises the real end-to-end apply path:
 * SketchConstraintToolbar button → createConstraint → addConstraint → buildSketch
 * → planegcs solve → solved sketch (DOF) reflected back in the toolbar.
 *
 * Drawing/selecting on the perspective 3D canvas is non-deterministic, so we seed
 * a sketch with two lines and drive *selection* through the viewport store (exactly
 * what canvas clicks do) — the constraint application, solve, and UI are all real.
 */

const SKETCH_ID = 'seed-sketch-1';

const WORKPLANE = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

// Connected L-shaped polyline (shared corner at origin) so the wire builds and the
// solved sketch (DOF) flows back. L1 horizontal, L2 slanted — parallel flattens L2.
const ELEMENTS = [
  { type: 'line', id: 'L1', start: { x: -30, y: 0 }, end: { x: 0, y: 0 } },
  { type: 'line', id: 'L2', start: { x: 0, y: 0 }, end: { x: 30, y: 30 } },
];
// L1 and L2 share the corner point id 'B' so OCC builds a connected wire
// (separate point ids at the same coords make MakeWire fail with disconnected edges).
const PRIMITIVES = [
  { id: 'A', type: 'point', fixed: false, data: { x: -30, y: 0 } },
  { id: 'B', type: 'point', fixed: false, data: { x: 0, y: 0 } },
  { id: 'L1', type: 'line', fixed: false, data: { p1_id: 'A', p2_id: 'B' } },
  { id: 'C', type: 'point', fixed: false, data: { x: 30, y: 30 } },
  { id: 'L2', type: 'line', fixed: false, data: { p1_id: 'B', p2_id: 'C' } },
];

const REFERENCE_GEOMETRY = [
  { id: 'front-plane', name: 'Front Plane', type: 'plane', isVisible: false },
  { id: 'top-plane', name: 'Top Plane', type: 'plane', isVisible: false },
  { id: 'right-plane', name: 'Right Plane', type: 'plane', isVisible: false },
  { id: 'origin', name: 'Origin', type: 'origin', isVisible: false },
];

async function seedProject(page: Page) {
  // Write a complete, valid project to localStorage (the app only persists on
  // change, so there's nothing to merge into on a fresh load).
  await page.evaluate(({ sketchId, workplane, elements, primitives, referenceGeometry }) => {
    const now = Date.now();
    const project = {
      id: 'e2e-project',
      name: 'Untitled Project',
      createdAt: now,
      updatedAt: now,
      version: 2,
      referenceGeometry,
      sketches: [
        {
          id: sketchId,
          name: 'Sketch 1',
          workplane,
          elements,
          primitives,
          constraints: [],
          visualMetadata: {},
          isClosed: false,
          isVisible: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      features: [],
    };
    window.localStorage.setItem('occad-project', JSON.stringify(project));
  }, { sketchId: SKETCH_ID, workplane: WORKPLANE, elements: ELEMENTS, primitives: PRIMITIVES, referenceGeometry: REFERENCE_GEOMETRY });
}

test.describe('Sketch line constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await seedProject(page);
    await page.reload();
    await page.waitForSelector('text=Front Plane', { timeout: 10000 });
  });

  // Each geometric line constraint, applied through the real toolbar button.
  const CASES = [
    { key: 'horizontal', select: ['L1'], type: 'horizontal_l', refs: { l_id: 'L1' } },
    { key: 'vertical', select: ['L1'], type: 'vertical_l', refs: { l_id: 'L1' } },
    { key: 'parallel', select: ['L1', 'L2'], type: 'parallel', refs: { l1_id: 'L1', l2_id: 'L2' } },
    { key: 'perpendicular', select: ['L1', 'L2'], type: 'perpendicular_ll', refs: { l1_id: 'L1', l2_id: 'L2' } },
    { key: 'equal', select: ['L1', 'L2'], type: 'equal_length', refs: { l1_id: 'L1', l2_id: 'L2' } },
  ];

  for (const { key, select, type, refs } of CASES) {
    test(`${key} registers a constraint and re-solves`, async ({ page }) => {
      // Enter sketch edit via the tree's Edit button
      await expect(page.locator('.tree-item-row').getByText('Sketch 1')).toBeVisible({ timeout: 15000 });
      await page.locator('.tree-item-row', { hasText: 'Sketch 1' }).hover();
      await page.getByTestId(`edit-${SKETCH_ID}`).click();

      // Constraint toolbar appears in sketch mode
      await expect(page.getByTestId('constraint-toolbar')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 0');
      // Let the initial on-load rebuild settle (it can transiently clear selection).
      await page.waitForTimeout(1500);

      // Drive selection through the store (mirrors clicking the lines on canvas) and
      // apply. Re-set selection each attempt in case an async re-render clears it.
      const btn = page.locator(`button[data-constraint="${key}"]`);
      await expect(async () => {
        await page.evaluate((ids) => {
          (window as any).__viewportStore.getState().setSketchElementSelection(ids);
        }, select);
        await btn.click({ timeout: 3000 });
      }).toPass({ timeout: 20000 });

      // Registered + surfaced in the toolbar
      await expect(page.getByTestId('constraint-count')).toHaveText('Solver Constraints: 1', { timeout: 10000 });
      // Solver ran end-to-end: DOF readout is populated with a number
      await expect(page.getByTestId('sketch-dof')).not.toHaveText('DOF: —', { timeout: 10000 });
      // The persisted constraint is the correct planegcs object built by createConstraint
      const persisted = await page.evaluate(() => {
        const raw = JSON.parse(window.localStorage.getItem('occad-project') || '{}');
        return (raw.sketches?.[0]?.constraints ?? [])[0];
      });
      expect(persisted).toMatchObject({ type, ...refs });
    });
  }
});
