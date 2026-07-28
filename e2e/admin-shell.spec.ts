import { expect, test } from '@playwright/test';

import { FRONTEND_E2E_ENTRY_POINTS } from '@vastra/frontend-test-harness';

const entryPoint = FRONTEND_E2E_ENTRY_POINTS.find(
  (candidate) => candidate.id === 'admin-shell-keyboard-and-responsive',
);
if (entryPoint === undefined) throw new Error('Admin E2E entry point is missing');

test('admin application exposes permission-aware landmarks and keyboard access', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('AAL2')).toBeVisible();
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('FE08 completes dashboard to search to recovery to audit', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('search')
    .getByPlaceholder('Order number, UUID, phone suffix or name')
    .fill('VAS');
  await page.getByRole('button', { name: 'Search' }).click();
  const searchResults = page.getByRole('list', { name: 'Search results' });
  await expect(searchResults).toBeVisible();
  await searchResults.getByRole('link', { name: /^VAS-260726-001\b/u }).click();
  await expect(page.getByRole('heading', { name: 'VAS-260726-001' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order status timeline' })).toBeVisible();

  await page.getByRole('button', { name: 'Restart captain search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Restart captain search' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Operational note/u).fill('FE08 audited browser recovery');
  await dialog.getByRole('button', { name: 'Restart dispatch' }).click();
  await expect(page.getByText('Authoritative operation completed.')).toBeVisible();
  await expect(page.getByText(/FE08 audited browser recovery/u)).toBeVisible();

  await page.getByRole('link', { name: 'Open audit explorer' }).click();
  await expect(page.getByRole('heading', { name: 'Admin audit' })).toBeVisible();
  await expect(page.getByText('FE08 audited browser recovery')).toBeVisible();
});

test('admin application reflows without losing operational navigation', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize(
    entryPoint.viewport.width > 760 ? { width: 390, height: 844 } : entryPoint.viewport,
  );
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
});

test('Phase 2E exposes fail-closed city configuration and activation evidence', async ({
  page,
}) => {
  await page.goto('/cities');
  await expect(page.getByRole('heading', { name: 'Cities' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tirupati' })).toBeVisible();
  await expect(page.getByText('Version 2')).toBeVisible();
  await expect(page.getByRole('cell', { name: /517501/u })).toBeVisible();

  await page.getByLabel('COD limit · paise').fill('225000');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(
    page.getByText('Configuration saved with a new authoritative version.'),
  ).toBeVisible();
  await expect(page.getByText('Version 3')).toBeVisible();

  await page.getByRole('button', { name: 'Run preflight' }).click();
  const dialog = page.getByRole('dialog', { name: 'Evaluate Tirupati' });
  await dialog.getByLabel('Note').fill('Phase 2E browser verification');
  await dialog.getByRole('button', { name: 'Run preflight' }).click();

  await expect(page.getByRole('heading', { name: 'Latest preflight' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Merchants', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate city' })).toBeDisabled();
});
