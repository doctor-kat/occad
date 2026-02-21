import { test, expect } from '@playwright/test';

test.describe('Transformation and Evaluation Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for any button to appear to ensure page load
        await page.waitForSelector('button', { timeout: 15000 });
    });

    test('should create a box and then apply move', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Transform' }).click();
        const moveButton = page.locator('button').filter({ hasText: /^Move$/ });
        await moveButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Move\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then apply rotate', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Transform' }).click();
        const rotateButton = page.locator('button').filter({ hasText: /^Rotate$/ });
        await rotateButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Rotate\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then apply mirror', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Transform' }).click();
        const mirrorButton = page.locator('button').filter({ hasText: /^Mirror$/ });
        await mirrorButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Mirror\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then apply scale', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Transform' }).click();
        const scaleButton = page.locator('button').filter({ hasText: /^Scale$/ });
        await scaleButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Scale\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then apply measure', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        await page.getByRole('tab', { name: 'Entities' }).click();
        const face1 = page.getByText(/^Face 1$/);
        await expect(face1).toBeVisible({ timeout: 15000 });
        await face1.click();

        await page.getByRole('tab', { name: 'Evaluate' }).click();
        const measureButton = page.locator('button').filter({ hasText: /^Measure$/ });
        await measureButton.click();
        
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Measure\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box, extrude it, then move it', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // Select Top Face
        await page.getByRole('tab', { name: 'Entities' }).click();
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        await expect(page.getByText('Extracting face geometry...')).toBeVisible({ timeout: 10000 });
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Sketch\s*\d+/)).toBeVisible({ timeout: 15000 });

        // Draw Rectangle
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

        // Extrude Boss
        await page.getByRole('tab', { name: 'Features' }).click();
        const extrudeButton = page.locator('button').filter({ hasText: /^Extrude Boss$/ });
        await extrudeButton.click();
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();
        await expect(page.getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // Move
        await page.getByRole('tab', { name: 'Transform' }).click();
        const moveButton = page.locator('button').filter({ hasText: /^Move$/ });
        await moveButton.click();
        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.getByText(/Move\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });
});
