import { expect, test } from '@playwright/test';

import { FRONTEND_E2E_ENTRY_POINTS } from '@vastra/frontend-test-harness';

const entryPoint = FRONTEND_E2E_ENTRY_POINTS.find(
  (candidate) => candidate.id === 'admin-shell-keyboard-and-responsive',
);
if (entryPoint === undefined) {
  throw new Error('Admin E2E entry point is missing');
}

test('admin application exposes keyboard and landmark foundations', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Vastra Admin — foundation ready' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('admin application reflows without losing semantic regions', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize(
    entryPoint.viewport.width > 760 ? { width: 390, height: 844 } : entryPoint.viewport,
  );

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('System shell available')).toBeVisible();
});
