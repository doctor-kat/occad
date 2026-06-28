import { test, expect } from '@playwright/test';
import { drawClosedRectangle } from './helpers';

test.describe('Modification Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('should have disabled Apply button when applying fillet without selection', async ({ page }) => {
        await page.getByRole('tab', { name: 'Modifications' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();
        
        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeDisabled({ timeout: 10000 });
    });

    test('should create a box and then apply fillet to an edge', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const edge1 = page.getByText(/^Edge 1$/);
        await expect(edge1).toBeVisible({ timeout: 15000 });
        await edge1.click();

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();
        
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Fillet\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then apply chamfer to an edge', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const edge1 = page.getByText(/^Edge 1$/);
        await expect(edge1).toBeVisible({ timeout: 15000 });
        await edge1.click();

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const chamferButton = page.locator('button').filter({ hasText: /^Chamfer$/ });
        await chamferButton.click();
        
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Chamfer\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then apply shell to a face', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const face1 = page.getByText(/^Face 1$/);
        await expect(face1).toBeVisible({ timeout: 15000 });
        await face1.click();

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const shellButton = page.locator('button').filter({ hasText: /^Shell$/ });
        await shellButton.click();
        
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Shell\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then apply offset to body', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const offsetButton = page.locator('button').filter({ hasText: /^Offset$/ });
        await offsetButton.click();
        
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Offset\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('should create a box and then extrude a shape from its top face, then fillet the new edge', async ({ page }) => {
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
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // 3. Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        
        // Switch sidebar back to Feature Tree to see the new sketch
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 20000 });

        // 4. Draw a Rectangle (robust against R3F pointer-event timing).
        const rectangleTool = page.locator('button').filter({ hasText: /^Corner Rectangle$/ });
        await rectangleTool.click();
        await drawClosedRectangle(page);
        await page.getByRole('button', { name: 'Finish Sketch' }).click();
        await expect(page.locator('text=Sketch completed')).toBeVisible({ timeout: 15000 });

        // 5. Extrude Boss
        await page.getByRole('tab', { name: 'Advanced' }).click();
        const extrudeButton = page.locator('button').filter({ hasText: /^Extrude Boss$/ });
        await extrudeButton.click();
        
        // Wait for OperationPanel title
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        
        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();
        
        await expect(page.locator('.tree-item-row').getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        // 6. Select an edge from the NEW extrusion and apply fillet
        await page.getByRole('tab', { name: 'Entities' }).click();
        const lastEdge = page.getByText(/Edge \d+/).last();
        await lastEdge.click();

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);

        // Switch to Feature Tree to ensure it's visible
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Fillet\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });
});
