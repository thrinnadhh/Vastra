import { afterEach, describe, expect, it } from 'vitest';

import {
  CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE,
  renderCustomerCodCheckoutScenario,
  startFixtureServer,
  type RunningFixtureServer,
} from '../src';

let server: RunningFixtureServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('customer COD checkout scenario', () => {
  it('renders the full deterministic transaction and failure-injection contract', () => {
    const markup = renderCustomerCodCheckoutScenario();

    expect(markup).toContain('data-scenario-id="customer-cod-checkout"');
    expect(markup).toContain('data-current-screen="product"');
    expect(markup).toContain('Product is ready.');
    expect(markup).toContain('Continue to delivery address');
    expect(markup).toContain('Review cash on delivery order');
    expect(markup).toContain('Order status not confirmed');
    expect(markup).toContain('Checkout quote changed');
    expect(markup).toContain('Track order');
    expect(markup).toContain('Expire session and purge state');
    expect(markup).toContain('Deny order access and purge state');
    expect(markup).not.toContain('fetch(');
    expect(markup).not.toContain('supabase');
    expect(markup).not.toContain('service_role');
  });

  it('exposes polite and assertive live regions plus non-colour status copy', () => {
    const markup = renderCustomerCodCheckoutScenario();

    expect(markup).toContain('role="status" aria-live="polite"');
    expect(markup).toContain('role="alert" aria-live="assertive"');
    expect(markup).toContain('Serviceable');
    expect(markup).toContain('Outside delivery area');
    expect(markup).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('serves the scenario through the deterministic no-store fixture server', async () => {
    server = await startFixtureServer({ port: 0 });

    const response = await fetch(`${server.origin}${CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE}`);
    const markup = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(markup).toContain('Cotton kurta set');
    expect(markup).toContain('Inject unknown placement result');
  });
});
