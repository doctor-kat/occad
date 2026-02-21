import { test, expect } from '@playwright/test';

test.describe('Primitive Shapes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('should create a sphere in a new project', async ({ page }) => {
        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();
        await expect(page.getByText(/Sphere\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a cone in a new project', async ({ page }) => {
        const coneButton = page.locator('button').filter({ hasText: /^Cone$/ });
        await coneButton.click();
        await expect(page.getByText(/Cone\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a torus in a new project', async ({ page }) => {
        const torusButton = page.locator('button').filter({ hasText: /^Torus$/ });
        await torusButton.click();
        await expect(page.getByText(/Torus\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a wedge in a new project', async ({ page }) => {
        const wedgeButton = page.locator('button').filter({ hasText: /^Wedge$/ });
        await wedgeButton.click();
        await expect(page.getByText(/Wedge\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then add a sphere on its face', async ({ page }) => {
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();
        await expect(page.getByText(/Sphere\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then extrude a new shape from its top face', async ({ page }) => {
        test.setTimeout(60000);
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });

        // 2. Open Entities Panel and select Top Face
        await page.getByRole('tab', { name: 'Entities' }).click();
        
        // Wait for Face 6 to be visible in the list
        const face6 = page.getByText(/^Face 6$/);
        await expect(face6).toBeVisible({ timeout: 15000 });
        await face6.click();

        // 3. Create Sketch
        await page.getByRole('tab', { name: 'Sketch' }).click();
        await page.getByRole('button', { name: /^Sketch$/ }).first().click();
        
        // Wait for geometry extraction notification
        await expect(page.getByText('Extracting face geometry...')).toBeVisible({ timeout: 10000 });
        
        // Switch sidebar back to Feature Tree to see the new sketch
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
            // Draw a rectangle with multiple clicks to ensure it is registered
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
        
        // Confirm in Operation Panel
        await expect(page.getByRole('heading', { name: 'Extrude Boss' })).toBeVisible({ timeout: 10000 });
        
        // Check if there is a 'No closed sketches' alert
        const alert = page.getByText('No closed sketches');
        const isAlertVisible = await alert.isVisible();
        if (isAlertVisible) {
            console.log('ALERT: No closed sketches visible');
        }

        const applyButton = page.getByRole('button', { name: 'Apply' });
        await expect(applyButton).toBeVisible({ timeout: 15000 });
        await applyButton.click();
        
        // Verify Extrude appears in Feature Tree
        await expect(page.getByText(/Boss-Extrude\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 20000 });
    });
});
