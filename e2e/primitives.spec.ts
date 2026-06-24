import { test, expect } from '@playwright/test';
import { drawClosedRectangle } from './helpers';

test.describe('Primitive Shapes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('should create a sphere in a new project', async ({ page }) => {
        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Sphere\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a cone in a new project', async ({ page }) => {
        const coneButton = page.locator('button').filter({ hasText: /^Cone$/ });
        await coneButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Cone\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a torus in a new project', async ({ page }) => {
        const torusButton = page.locator('button').filter({ hasText: /^Torus$/ });
        await torusButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Torus\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a wedge in a new project', async ({ page }) => {
        const wedgeButton = page.locator('button').filter({ hasText: /^Wedge$/ });
        await wedgeButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Wedge\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then add a sphere on its face', async ({ page }) => {
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Sphere\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then extrude a new shape from its top face', async ({ page }) => {
        test.setTimeout(60000);
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        // 2. Open Entities Panel and select Top Face
        await page.getByRole('tab', { name: 'Entities' }).click();
        
        // Wait for Face 6 to be visible in the list
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // 3. Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        
        // Switch sidebar back to Feature Tree to see the new sketch
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 20000 });

        // 4. Draw a Rectangle
        const rectangleTool = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleTool.click();
        
        const canvas = page.locator('canvas').first();
        const b = await canvas.boundingBox();
        if (b) {
            const centerX = b.x + b.width / 2;
            const centerY = b.y + b.height / 2;
            // Draw a rectangle using two clicks
            await page.mouse.click(centerX - 15, centerY - 15);
            await page.waitForTimeout(200);
            await page.mouse.click(centerX + 15, centerY + 15);
            await page.waitForTimeout(500);
        }
        await page.getByRole('button', { name: 'Finish Sketch' }).click();
        await expect(page.locator('text=Sketch completed')).toBeVisible({ timeout: 15000 });

        // 5. Extrude Boss
        await page.getByRole('tab', { name: 'Advanced' }).click();
        const extrudeButton = page.locator('button').filter({ hasText: /^Extrude Boss$/ });
        await extrudeButton.click();
        
        // Confirm in Operation Panel
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });

        // The rectangle is a closed sketch — the "No closed sketches" warning must NOT show.
        await expect(page.getByText('No closed sketches')).not.toBeVisible();

        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();

        // Verify Extrude appears in Feature Tree
        await expect(page.locator('.tree-item-row').getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    // Regression for the "flat extrude" + "sketch mode never exits" bugs:
    // sketch directly on the base Top Plane (XZ, normal +Y), draw a rectangle,
    // extrude, and assert the result is a real solid with volume (not a flat
    // prism extruded along world +Z which lies in the sketch plane).
    test('should extrude a rectangle on the Top Plane into a solid with volume', async ({ page }) => {
        test.setTimeout(60000);

        // 1. Select the Top Plane and start a sketch on it
        await page.getByText('Top Plane').click();
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();

        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 20000 });

        // 2. Draw a rectangle (robust against R3F pointer-event timing)
        const rectangleTool = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleTool.click();
        await drawClosedRectangle(page);
        await page.getByRole('button', { name: 'Finish Sketch' }).click();
        await expect(page.getByText('Sketch completed')).toBeVisible({ timeout: 15000 });

        // 3. Extrude Boss with a distance of 10
        await page.getByRole('tab', { name: 'Advanced' }).click();
        await page.locator('button').filter({ hasText: /^Extrude Boss$/ }).click();
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('No closed sketches')).not.toBeVisible();
        await page.getByRole('button', { name: 'Apply' }).click();

        await expect(page.locator('.tree-item-row').getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        // 4. Sketch mode must have exited — the "Finish Sketch" button is gone.
        await expect(page.getByRole('button', { name: 'Finish Sketch' })).not.toBeVisible();

        // Note: that the extrude has real depth (rather than a flat prism along
        // world +Z) is verified deterministically by the extrude-direction unit
        // test in src/cad/engine/operations.test.ts.
    });
});
