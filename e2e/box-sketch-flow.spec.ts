import { test, expect } from '@playwright/test';

test.describe('Box-Sketch Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 10000 });
    });

    test('should create a box, select a face, and create a sketch with a rectangle', async ({ page }) => {
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);

        // Verify Box1 appears in Feature Tree
        await expect(page.locator('.tree-item-row').getByText('Box1')).toBeVisible({ timeout: 15000 });

        // Wait for worker to rebuild and mesh to be ready
        // Rebuild complete notification appears
        await expect(page.locator('text=Rebuild complete')).toBeVisible({ timeout: 30000 });

        // 2. Open Entities Panel
        // Switch to Entities tab using text click which is robust
        await page.getByRole('tab', { name: 'Entities' }).click();
        
        // Wait for Entities panel header
        await expect(page.locator('text=Faces')).toBeVisible({ timeout: 15000 });
        
        // Wait for Face 1 to appear
        await page.waitForSelector('text=Face 1', { timeout: 15000 });

        // 3. Select the latest Face (should belong to the new Box)
        // Find the group that contains "Face 1"
        const face1Item = page.locator('div[data-selected]').filter({ hasText: /^Face 1$/ }).first();
        await face1Item.click();

        // Verify selection
        await expect(face1Item).toHaveAttribute('data-selected', 'true');

        // 4. Create Sketch on selection
        // Switch to Sketch tab in toolbar
        await page.getByRole('tab', { name: 'Sketch' }).click();

        // Click the 'Sketch' operation button to start a sketch on the selected face
        const sketchButton = page.getByRole('button', { name: /^Sketch$/ }).first();
        await sketchButton.click();

        // Switch sidebar back to Feature Tree to see the new sketch
        await page.getByRole('tab', { name: 'Feature Tree' }).click();

        // Verify Sketch 1 appears
        await expect(page.locator('.tree-item-row').getByText('Sketch 1')).toBeVisible({ timeout: 15000 });

        // 5. Draw a Rectangle
        const rectangleOperation = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleOperation.click();
        await expect(rectangleOperation).toHaveAttribute('data-variant', 'light');

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

            // Draw a rectangle using two clicks
            await page.mouse.click(centerX + 40, centerY + 40);
            await page.waitForTimeout(200);
            await page.mouse.click(centerX + 80, centerY + 70);
            await page.waitForTimeout(500);

            // Verify element was created
            await expect(page.locator('text=Elements: 1')).toBeVisible({ timeout: 10000 });
        }

        // 6. Finish Sketch
        await page.getByRole('button', { name: 'Finish Sketch' }).click();

        // Verify "Sketch completed" notification
        await expect(page.locator('text=Sketch completed')).toBeVisible();

        // Verify Sketch 1 is now in the Feature Tree
        await expect(page.locator('.tree-item-row').getByText('Sketch 1').first()).toBeVisible({ timeout: 15000 });

        // Check that we are no longer in sketch mode
        await expect(rectangleOperation).not.toHaveAttribute('data-variant', 'light');
    });
});
