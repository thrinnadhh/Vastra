import { expect, type Page, type TestInfo, test } from '@playwright/test';

import { CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE } from '@vastra/frontend-test-harness';

const SCENARIO_SELECTOR = '[data-scenario-id="customer-cod-checkout"]';

function scenario(page: Page) {
  return page.locator(SCENARIO_SELECTOR);
}

async function openCart(page: Page): Promise<void> {
  await page.goto(CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE);
  await page.getByRole('button', { name: 'Add available size to cart' }).click();
  await page.getByRole('button', { name: 'Open cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
}

async function openQuote(page: Page): Promise<void> {
  await openCart(page);
  await page.getByRole('button', { name: 'Continue to delivery address' }).click();
  await page.getByRole('radio', { name: /Home/ }).check();
  await page.getByRole('button', { name: 'Continue to checkout quote' }).click();
  await expect(page.getByRole('heading', { name: 'Review checkout' })).toBeVisible();
}

async function openCodConfirmation(page: Page): Promise<void> {
  await openQuote(page);
  await page.getByRole('button', { name: 'Review cash on delivery order' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm cash on delivery' })).toBeVisible();
}

async function placeOrder(page: Page): Promise<void> {
  await openCodConfirmation(page);
  await page.getByRole('button', { name: 'Confirm and place COD order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
}

async function attachEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test('completes product to tracking with authoritative COD state', async ({ page }) => {
  await placeOrder(page);

  await expect(scenario(page)).toHaveAttribute('data-placement-phase', 'SUCCEEDED');
  await expect(scenario(page)).toHaveAttribute('data-placement-attempts', '1');
  await expect(scenario(page)).toHaveAttribute(
    'data-order-id',
    '40000000-0000-4000-8000-000000000001',
  );
  await expect(page.getByText('VST-260724-1042')).toBeVisible();

  await page.getByRole('button', { name: 'View delivery tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Track order' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Order tracking timeline' })).toContainText(
    'Merchant is preparing your order',
  );
  await page.getByRole('button', { name: 'Reveal delivery OTP' }).click();
  await expect(page.getByText('482913')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal delivery OTP' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('guards duplicate submission synchronously', async ({ page }) => {
  await openCodConfirmation(page);
  const root = scenario(page);
  const originalKey = await root.getAttribute('data-idempotency-key');

  await page.locator('#confirm-cod').evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected order button');
    button.click();
    button.click();
  });

  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(root).toHaveAttribute('data-placement-attempts', '1');
  await expect(root).toHaveAttribute('data-idempotency-key', originalKey ?? '');
});

test('reconciles an unknown placement result with the original key', async ({ page }) => {
  await openCodConfirmation(page);
  const root = scenario(page);
  const originalKey = await root.getAttribute('data-idempotency-key');

  await page.getByRole('button', { name: 'Inject unknown placement result' }).click();
  await page.getByRole('button', { name: 'Confirm and place COD order' }).click();

  await expect(page.getByRole('heading', { name: 'Order status not confirmed' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('unknown');
  await expect(root).toHaveAttribute('data-placement-phase', 'UNCERTAIN');
  await expect(root).toHaveAttribute('data-placement-attempts', '1');

  await page.getByRole('button', { name: 'Check order using the same key' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(root).toHaveAttribute('data-placement-phase', 'SUCCEEDED');
  await expect(root).toHaveAttribute('data-placement-attempts', '2');
  await expect(root).toHaveAttribute('data-idempotency-key', originalKey ?? '');
});

test('rejects a stale quote and refreshes without changing the transaction key', async ({
  page,
}) => {
  await openCodConfirmation(page);
  const root = scenario(page);
  const firstQuoteId = await root.getAttribute('data-quote-id');
  const originalKey = await root.getAttribute('data-idempotency-key');

  await page.getByRole('button', { name: 'Inject stale quote on placement' }).click();
  await page.getByRole('button', { name: 'Confirm and place COD order' }).click();

  await expect(page.getByRole('heading', { name: 'Checkout quote changed' })).toBeVisible();
  await expect(root).toHaveAttribute('data-quote-id', '');
  await expect(root).toHaveAttribute('data-order-id', '');

  await page.getByRole('button', { name: 'Refresh checkout quote' }).click();
  await expect(page.getByRole('heading', { name: 'Review checkout' })).toBeVisible();
  await expect(root).not.toHaveAttribute('data-quote-id', firstQuoteId ?? '');
  await expect(root).toHaveAttribute('data-idempotency-key', originalKey ?? '');
});

test('invalidates quote identity when address or cart changes', async ({ page }) => {
  await openQuote(page);
  const root = scenario(page);
  const firstQuoteId = await root.getAttribute('data-quote-id');
  const originalKey = await root.getAttribute('data-idempotency-key');

  await page.getByRole('button', { name: 'Change delivery address' }).click();
  await expect(root).toHaveAttribute('data-quote-id', '');
  await page.getByRole('radio', { name: /Home/ }).check();
  await page.getByRole('button', { name: 'Continue to checkout quote' }).click();
  await expect(root).not.toHaveAttribute('data-quote-id', firstQuoteId ?? '');
  await expect(root).toHaveAttribute('data-idempotency-key', originalKey ?? '');

  await page.getByRole('button', { name: 'Return to cart' }).click();
  await expect(root).toHaveAttribute('data-quote-id', '');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByText('₹2,598')).toBeVisible();
});

test('recovers the exact prior screen after an offline failure', async ({ page }) => {
  await openQuote(page);

  await page.getByRole('button', { name: 'Inject offline state' }).click();
  await expect(page.getByRole('heading', { name: 'You are offline' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Network unavailable');
  await page.getByRole('button', { name: 'Try connection again' }).click();

  await expect(page.getByRole('heading', { name: 'Review checkout' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('previous screen recovered');
});

test('purges checkout identifiers on session expiry', async ({ page }) => {
  await openQuote(page);
  const root = scenario(page);

  await page.getByRole('button', { name: 'Expire session and purge state' }).click();

  await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible();
  await expect(root).toHaveAttribute('data-sensitive-state', 'empty');
  await expect(root).toHaveAttribute('data-cart-id', '');
  await expect(root).toHaveAttribute('data-address-id', '');
  await expect(root).toHaveAttribute('data-quote-id', '');
  await expect(root).toHaveAttribute('data-order-id', '');
  await expect(root).toHaveAttribute('data-idempotency-key', '');
});

test('purges owned order data after authorization failure', async ({ page }) => {
  await placeOrder(page);
  const root = scenario(page);

  await page.getByRole('button', { name: 'Deny order access and purge state' }).click();

  await expect(page.getByRole('heading', { name: 'Order unavailable' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Authorization failed');
  await expect(root).toHaveAttribute('data-sensitive-state', 'empty');
  await expect(root).toHaveAttribute('data-order-id', '');
});

test('exposes keyboard, landmark, live-region and control semantics', async ({ page }) => {
  await page.goto(CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE);

  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  await expect(page.getByRole('complementary', { name: 'Failure injection controls' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Office/ })).toBeDisabled();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to checkout scenario' })).toBeFocused();
  await page.getByRole('link', { name: 'Skip to checkout scenario' }).press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await page.getByRole('button', { name: 'Add available size to cart' }).focus();
  const target = await page
    .getByRole('button', { name: 'Add available size to cart' })
    .boundingBox();
  expect(target?.height ?? 0).toBeGreaterThanOrEqual(48);
});

test('captures mobile and desktop evidence for all transaction states', async ({ page }, testInfo) => {
  await page.goto(CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE);
  await attachEvidence(page, testInfo, '01-product');

  await page.getByRole('button', { name: 'Add available size to cart' }).click();
  await page.getByRole('button', { name: 'Open cart' }).click();
  await attachEvidence(page, testInfo, '02-cart');

  await page.getByRole('button', { name: 'Continue to delivery address' }).click();
  await attachEvidence(page, testInfo, '03-address');
  await page.getByRole('radio', { name: /Home/ }).check();
  await page.getByRole('button', { name: 'Continue to checkout quote' }).click();
  await attachEvidence(page, testInfo, '04-quote');

  await page.getByRole('button', { name: 'Review cash on delivery order' }).click();
  await attachEvidence(page, testInfo, '05-cod-confirmation');
  await page.getByRole('button', { name: 'Inject unknown placement result' }).click();
  await page.getByRole('button', { name: 'Confirm and place COD order' }).click();
  await expect(page.getByRole('heading', { name: 'Order status not confirmed' })).toBeVisible();
  await attachEvidence(page, testInfo, '06-uncertain');

  await page.getByRole('button', { name: 'Check order using the same key' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await attachEvidence(page, testInfo, '07-order-confirmation');
  await page.getByRole('button', { name: 'View delivery tracking' }).click();
  await attachEvidence(page, testInfo, '08-tracking');

  await page.getByRole('button', { name: 'Inject offline state' }).click();
  await attachEvidence(page, testInfo, '09-offline');
  await page.getByRole('button', { name: 'Try connection again' }).click();
  await page.getByRole('button', { name: 'Deny order access and purge state' }).click();
  await attachEvidence(page, testInfo, '10-authorization-purge');
});
