import { expect, type Page, test } from '@playwright/test';

import { CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE } from '@vastra/frontend-test-harness';

async function completeOtp(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Phone sign in' })).toBeVisible();
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('One-time code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
}

async function completeFirstLaunch(page: Page): Promise<void> {
  await page.goto(CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE);
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await completeOtp(page);
  await expect(page.getByRole('heading', { name: 'Location access' })).toBeVisible();
  await page.getByRole('button', { name: 'Location permission denied' }).click();
  await expect(page.getByRole('heading', { name: 'Choose location manually' })).toBeVisible();
  await page.getByLabel('Manual location').fill('Tirupati');
  await page.getByRole('button', { name: 'Use Tirupati' }).click();
  await expect(page.getByRole('heading', { name: 'Customer application' })).toBeVisible();
}

test('first launch reaches the five-tab app through manual location fallback', async ({ page }) => {
  await completeFirstLaunch(page);

  await expect(page.getByRole('tab')).toHaveCount(5);
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-scenario-id="customer-access-navigation"]')).toHaveAttribute(
    'data-authenticated',
    'true',
  );
  await expect(page.getByRole('status')).toContainText('Manual Tirupati location accepted');
});

test('tabs retain canonical state and Checkout returns through the transaction boundary', async ({
  page,
}) => {
  await completeFirstLaunch(page);

  await page.getByRole('tab', { name: 'Orders' }).click();
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Orders' })).toContainText(
    'Your orders remain server-authoritative.',
  );

  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Open checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText('not a sixth tab')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Home' }).click();

  await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status')).toContainText('Returned from Checkout to Home');
});

test('a valid protected link continues after authentication without leaking auth context', async ({
  page,
}) => {
  await page.goto(CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE);
  await page.getByRole('button', { name: 'Open valid order link' }).click();

  const scenario = page.locator('[data-scenario-id="customer-access-navigation"]');
  await expect(scenario).toHaveAttribute('data-pending-destination', 'Orders');
  await completeOtp(page);

  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  await expect(scenario).toHaveAttribute('data-pending-destination', '');
  await expect(page.getByRole('status')).toContainText('Continued to Orders');
});

test('invalid, wrong-role, and unauthorized links fail safely', async ({ page }) => {
  await page.goto(CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE);
  await page.getByRole('button', { name: 'Open invalid link' }).click();
  await expect(page.getByRole('heading', { name: 'Link unavailable' })).toBeVisible();
  await expect(page.getByText('not supported or is no longer valid')).toBeVisible();
  await page.getByRole('button', { name: 'Return safely' }).click();

  await page.getByRole('button', { name: 'Open merchant-only link' }).click();
  await expect(page.getByRole('heading', { name: 'Wrong application' })).toBeVisible();
  await expect(page.getByText('cannot open a merchant destination')).toBeVisible();
  await page.getByRole('button', { name: 'Return safely' }).click();

  await page.getByRole('button', { name: 'Open unauthorized order link' }).click();
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByText('This destination is unavailable for this account.')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'without exposing resource details',
  );
});

test('session expiry retains and restores the selected destination', async ({ page }) => {
  await completeFirstLaunch(page);
  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Expire session' }).click();

  const scenario = page.locator('[data-scenario-id="customer-access-navigation"]');
  await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible();
  await expect(scenario).toHaveAttribute('data-pending-destination', 'Profile');
  await page.getByRole('button', { name: 'Sign in again' }).click();
  await completeOtp(page);

  await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tabpanel', { name: 'Profile' })).toContainText(
    'profile identity remains server-owned',
  );
  await expect(scenario).toHaveAttribute('data-pending-destination', '');
});

test('access and tab controls expose keyboard and landmark semantics', async ({ page }) => {
  await page.goto(CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE);

  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Continue to sign in' })).toBeFocused();

  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await expect(page.getByLabel('Phone number')).toBeVisible();
  await completeOtp(page);
  await page.getByRole('button', { name: 'Allow location' }).click();

  await expect(page.getByRole('tablist', { name: 'Customer tabs' })).toBeVisible();
  for (const label of ['Home', 'Discover', 'Style', 'Orders', 'Profile']) {
    await expect(page.getByRole('tab', { name: label })).toBeVisible();
  }
});
