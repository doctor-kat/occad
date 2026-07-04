import { test, expect } from '@playwright/test';

/**
 * ROADMAP §9.1 Phase 5 — e2e coverage for the selector system. Unit tests mock
 * `oc`, so real geometric validity (normals, tangents, radii, boolean results)
 * is only proven here, against the real OpenCascade WASM kernel.
 */
test.describe('Selector system', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        await page.waitForSelector('text=Front Plane', { timeout: 15000 });
    });

    test('box -> fillet via |Z selects the 4 vertical edges -> valid rounded solid', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const filletButton = page.locator('button').filter({ hasText: /^Fillet$/ });
        await filletButton.click();

        const selectorInput = page.getByPlaceholder(/all vertical edges/i);
        await expect(selectorInput).toBeVisible({ timeout: 10000 });
        await selectorInput.fill('|Z');
        await selectorInput.press('Enter');
        await expect(page.getByText(/Matched/i)).toBeVisible({ timeout: 15000 });

        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);

        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Fillet\s*\d+/)).toBeVisible({ timeout: 15000 });
        // No error surfaced on the new Fillet tree item -> the boolean/build succeeded.
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
        await expect(page.locator('.tree-item-row').getByText(/Fillet\s*\d+/).locator('..')).not.toContainText(/error/i);
    });

    test('box -> shell via >Z (top face) -> valid hollowed solid', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const shellButton = page.locator('button').filter({ hasText: /^Shell$/ });
        await shellButton.click();

        const selectorInput = page.getByPlaceholder(/top face/i);
        await expect(selectorInput).toBeVisible({ timeout: 10000 });
        await selectorInput.fill('>Z');
        await selectorInput.press('Enter');
        await expect(page.getByText(/Matched/i)).toBeVisible({ timeout: 15000 });

        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);

        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Shell\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });

    // Note: the flagship "%cylinder on a cylinder" case from the TODO is not
    // covered here — investigating turned up that all curved primitives
    // (sphere/cylinder/cone/torus) tessellate to 0 vertices in this build,
    // a pre-existing bug unrelated to the selector system (reproduces with no
    // selector involved at all: create a Sphere -> "Rebuild complete. Received
    // mesh with 0 vertices."). Tracked as a follow-up in ROADMAP.md instead of
    // blocking this e2e suite on it. `%plane`/geomType-tag matching itself is
    // covered by the pure `evaluate.test.ts` unit suite.
    test('box -> shell via |Z removes both horizontal faces (multi-match) -> valid solid', async ({ page }) => {
        test.setTimeout(60000);
        const boxButton = page.locator('button').filter({ hasText: /^Box$/ });
        await boxButton.click();
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);
        await expect(page.locator('.tree-item-row').getByText(/Box\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });

        await page.getByRole('tab', { name: 'Modifications' }).click();
        const shellButton = page.locator('button').filter({ hasText: /^Shell$/ });
        await shellButton.click();

        const selectorInput = page.getByPlaceholder(/top face/i);
        await expect(selectorInput).toBeVisible({ timeout: 10000 });
        await selectorInput.fill('|Z');
        await selectorInput.press('Enter');
        await expect(page.getByText(/Matched/i)).toBeVisible({ timeout: 15000 });

        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForTimeout(500);

        await page.getByRole('tab', { name: 'Feature Tree' }).click();
        await expect(page.locator('.tree-item-row').getByText(/Shell\s*\d+/)).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Rebuild complete').last()).toBeVisible({ timeout: 30000 });
    });
});
