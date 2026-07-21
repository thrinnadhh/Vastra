import { expect, test } from '@playwright/test';

import { FRONTEND_E2E_ENTRY_POINTS } from '@vastra/frontend-test-harness';

const mobileEntryPoints = FRONTEND_E2E_ENTRY_POINTS.filter(
  (entryPoint) => entryPoint.owner === 'mobile',
);

for (const entryPoint of mobileEntryPoints) {
  test(`${entryPoint.id} preserves the mobile shell contract`, async ({ page }) => {
    await page.setViewportSize(entryPoint.viewport);
    await page.goto(entryPoint.route);

    const shell = page.locator('[data-fixture-id]');
    await expect(shell).toBeVisible();
    await expect(shell.locator('[data-safe-area="top,right,bottom,left"]')).toBeVisible();
    await expect(shell.locator('[data-slot="header"]')).toBeVisible();
    await expect(shell.locator('[data-slot="content"]')).toHaveAttribute(
      'data-keyboard-aware',
      'true',
    );
    await expect(shell.locator('[data-slot="footer"]')).toBeVisible();
    await expect(shell.locator('[data-slot="overlay"]')).toBeVisible();

    const role = await shell.getAttribute('data-role');
    if (role === 'merchant' || role === 'captain') {
      await expect(shell).toHaveAttribute('data-mode', 'commerce');
    }
  });
}
