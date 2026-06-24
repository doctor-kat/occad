import { test, expect } from '@playwright/test';

test.describe('Undo / Redo', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('undo removes a created box; redo restores it (and rebuilds)', async ({ page }) => {
        test.setTimeout(60000);

        // Create a box.
        await page.locator('button').filter({ hasText: /^Box$/ }).click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        // Undo: the feature disappears from the tree (and the body rebuilds empty).
        const undo = page.getByRole('button', { name: 'Undo' });
        await expect(undo).toBeEnabled();
        await undo.click();
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toHaveCount(0, { timeout: 15000 });

        // Redo: the feature returns and the model rebuilds.
        const redo = page.getByRole('button', { name: 'Redo' });
        await expect(redo).toBeEnabled();
        await redo.click();
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    test('undo/redo buttons are disabled when there is no history', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
    });
});
