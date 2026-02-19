import { test, expect } from '@playwright/test';

test.describe('Box-Sketch Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for initial load
        await page.waitForSelector('text=Boss-Extrude1', { timeout: 10000 });
    });

    test('should create a box, select a face, and create a sketch with a rectangle', async ({ page }) => {
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();

        // Verify Box2 appears in Feature Tree
        await expect(page.locator('text=Box2')).toBeVisible({ timeout: 10000 });

        // Wait for worker to rebuild and mesh to be ready
        await expect(page.locator('text=Rebuild complete')).toBeVisible({ timeout: 15000 });

        // 2. Open Entities Panel if not already open (it's absolute positioned, should be visible if mesh exists)
        // The panel appears when mesh is available.
        await expect(page.locator('text=Entities')).toBeVisible({ timeout: 10000 });

        // 3. Select the latest Face (should belong to the new Box)
        const allFaces = page.locator('div[data-selected]').filter({ hasText: /^Face \d+$/ });
        const lastFace = allFaces.last();
        await lastFace.click();

        // Verify selection
        await expect(lastFace).toHaveAttribute('data-selected', 'true');

        // 4. Create Sketch on selection
        // Switch to Sketch tab first
        await page.getByRole('tab', { name: 'Sketch' }).click();

        // Click the 'Sketch' tool button to start a sketch on the selected face
        const sketchButton = page.getByRole('button', { name: /^Sketch$/ });
        await sketchButton.click();

        // Verify Sketch2 appears and we are in sketch mode (Sketch tab active)
        await expect(page.locator('text=Sketch 2')).toBeVisible({ timeout: 10000 });

        // 5. Draw a Rectangle
        const rectangleTool = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleTool.click();
        await expect(rectangleTool).toHaveAttribute('data-variant', 'light');

        // Wait a bit for the sketch plane mesh to be ready in the DOM/Canvas
        await page.waitForTimeout(1000);

        // Click in the viewport to draw (coordinates are arbitrary for this test as long as they are distinct)
        const canvas = page.locator('canvas').first();
        const box = await canvas.boundingBox();
        if (box) {
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            // Hover first to ensure mouse events are directed correctly
            await page.mouse.move(centerX, centerY);
            await page.waitForTimeout(100);

            // Draw a non-symmetrical rectangle (click-click)
            // Clicks at +40 and +80 should be outside the box (which extends to +25)
            await page.mouse.click(centerX + 40, centerY + 40); // First corner
            await page.waitForTimeout(500);
            await page.mouse.click(centerX + 80, centerY + 70); // Second corner
            await page.waitForTimeout(500);
        }

        // 6. Finish Sketch
        await sketchButton.click();

        // Verify "Sketch completed" notification
        await expect(page.locator('text=Sketch completed')).toBeVisible();

        // Verify Sketch 2 is now in the Feature Tree
        await expect(page.locator('text=Sketch 2').first()).toBeVisible({ timeout: 15000 });

        // Check that we are no longer in sketch mode
        await expect(rectangleTool).not.toHaveAttribute('data-variant', 'light');
    });
});
