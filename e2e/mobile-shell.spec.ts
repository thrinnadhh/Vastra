import { expect, test } from '@playwright/test';

import {
  FRONTEND_E2E_ENTRY_POINTS,
  getFrontendFixture,
} from '@vastra/frontend-test-harness';

const mobileEntryPoints = FRONTEND_E2E_ENTRY_POINTS.filter(
  (entryPoint) => entryPoint.owner === 'mobile',
);

for (const entryPoint of mobileEntryPoints) {
  const fixture = getFrontendFixture(entryPoint.fixtureId);
  if (fixture?.fixtureKind !== 'mobileShell') {
    throw new Error(`Mobile E2E entry point has no mobile shell fixture: ${entryPoint.id}`);
  }

  test(`${entryPoint.id} preserves the mobile shell contract`, async ({ page }) => {
    await page.setViewportSize(entryPoint.viewport);
    await page.goto(entryPoint.route);

    const shell = page.locator('[data-fixture-id]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-role', fixture.contract.role);
    await expect(shell).toHaveAttribute('data-mode', fixture.contract.mode);
    await expect(shell.locator('[data-safe-area="top,right,bottom,left"]')).toBeVisible();
    await expect(shell.locator('[data-slot="header"]')).toBeVisible();
    await expect(shell.locator('[data-slot="content"]')).toHaveAttribute(
      'data-keyboard-aware',
      'true',
    );
    await expect(shell.locator('[data-slot="footer"]')).toBeVisible();
    await expect(shell.locator('[data-slot="overlay"]')).toBeVisible();
  });
}
