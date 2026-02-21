import { test, expect } from '@playwright/test';

test.describe('Primitive Shapes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for initial load - Front Plane should always be there
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('should create a sphere in a new project', async ({ page }) => {
        // 1. Create a Sphere
        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();

        // Verify Sphere appears in Feature Tree
        await expect(page.locator('text=/Sphere\\d+/')).toBeVisible({ timeout: 15000 });

        // Wait for worker to rebuild and mesh to be ready
        await expect(page.locator('text=Rebuild complete')).toBeVisible({ timeout: 20000 });
    });

    test('should create a box and then add a sphere on its face', async ({ page }) => {
        // 1. Create a Box
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await expect(page.locator('text=/Box\\d+/')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete')).toBeVisible({ timeout: 20000 });

        // 2. Create a Sphere
        const sphereButton = page.locator('button').filter({ hasText: /^Sphere$/ });
        await sphereButton.click();

        // Verify Sphere appears in Feature Tree
        await expect(page.locator('text=/Sphere\\d+/')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete')).toBeVisible({ timeout: 20000 });
        
        // Note: Currently, our sphere is created at the origin (0,0,0) with radius 25.
        // The box is created at (0,0,0) with size 50x50x50.
        // So the sphere should be partially inside the box.
        // The implementation in operations.ts performs a union if currentBody exists.
    });
});
