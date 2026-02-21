import { test, expect } from '@playwright/test';

test.describe('Modification Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('should show warning when applying fillet without selection', async ({ page }) => {
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();
        await expect(page.getByText('Select an edge first to apply fillet')).toBeVisible({ timeout: 10000 });
    });

    test('should create a box and then apply fillet to an edge', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const edge1 = page.getByText(/^Edge 1$/);
        await expect(edge1).toBeVisible({ timeout: 15000 });
        await edge1.click();

        await page.getByRole('tab', { name: 'Features' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Fillet\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then apply chamfer to an edge', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const edge1 = page.getByText(/^Edge 1$/);
        await expect(edge1).toBeVisible({ timeout: 15000 });
        await edge1.click();

        await page.getByRole('tab', { name: 'Features' }).click();
        const chamferButton = page.locator('button').filter({ hasText: /^Chamfer$/ });
        await chamferButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Chamfer\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then extrude a shape from its top face, then fillet the new edge', async ({ page }) => {
        test.setTimeout(60000);
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // 2. Open Entities Panel and select Top Face
        await page.getByRole('tab', { name: 'Entities' }).click();
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // 3. Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        await expect(page.getByText('Extracting face geometry...')).toBeVisible({ timeout: 10000 });
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 15000 });

        // 4. Draw a Rectangle
        const rectangleTool = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleTool.click();
        
        const canvas = page.locator('canvas').first();
        const b = await canvas.boundingBox();
        if (b) {
            const centerX = b.x + b.width / 2;
            const centerY = b.y + b.height / 2;
            await page.mouse.move(centerX - 15, centerY - 15);
            await page.mouse.click(centerX - 15, centerY - 15);
            await page.waitForTimeout(200);
            await page.mouse.move(centerX + 15, centerY + 15);
            await page.mouse.click(centerX + 15, centerY + 15);
        }
        await page.getByRole('button', { name: 'Finish Sketch' }).click();
        await expect(page.locator('text=Sketch completed')).toBeVisible({ timeout: 15000 });

        // 5. Extrude Boss
        await page.getByRole('tab', { name: 'Features' }).click();
        const extrudeButton = page.locator('button').filter({ hasText: /^Extrude Boss$/ });
        await extrudeButton.click();
        
        // Wait for OperationPanel title
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        
        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();
        
        await expect(page.getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // 6. Select an edge from the NEW extrusion and apply fillet
        await page.getByRole('tab', { name: 'Entities' }).click();
        const lastEdge = page.getByText(/Edge \d+/).last();
        await lastEdge.click();

        await page.getByRole('tab', { name: 'Features' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();

        // Switch to Feature Tree to ensure it's visible
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Fillet\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then extrude a shape from its top face, then chamfer the new edge', async ({ page }) => {
        test.setTimeout(60000);
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // 2. Open Entities Panel and select Top Face
        await page.getByRole('tab', { name: 'Entities' }).click();
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // 3. Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        await expect(page.getByText('Extracting face geometry...')).toBeVisible({ timeout: 10000 });
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 15000 });

        // 4. Draw a Rectangle
        const rectangleTool = page.locator('button').filter({ hasText: /^Rectangle$/ });
        await rectangleTool.click();
        
        const canvas = page.locator('canvas').first();
        const b = await canvas.boundingBox();
        if (b) {
            const centerX = b.x + b.width / 2;
            const centerY = b.y + b.height / 2;
            await page.mouse.move(centerX - 15, centerY - 15);
            await page.mouse.click(centerX - 15, centerY - 15);
            await page.waitForTimeout(200);
            await page.mouse.move(centerX + 15, centerY + 15);
            await page.mouse.click(centerX + 15, centerY + 15);
        }
        await page.getByRole('button', { name: 'Finish Sketch' }).click();
        await expect(page.locator('text=Sketch completed')).toBeVisible({ timeout: 15000 });

        // 5. Extrude Boss
        await page.getByRole('tab', { name: 'Features' }).click();
        const extrudeButton = page.locator('button').filter({ hasText: /^Extrude Boss$/ });
        await extrudeButton.click();
        
        // Wait for OperationPanel title
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        
        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();
        
        await expect(page.getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // 6. Select an edge from the NEW extrusion and apply chamfer
        await page.getByRole('tab', { name: 'Entities' }).click();
        const lastEdge = page.getByText(/Edge \d+/).last();
        await lastEdge.click();

        await page.getByRole('tab', { name: 'Features' }).click();
        const chamferButton = page.locator('button').filter({ hasText: /^Chamfer$/ });
        await chamferButton.click();

        // Switch to Feature Tree
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Chamfer\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });
});
