import { afterEach, describe, expect, it } from 'vitest';

import {
  CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE,
  renderCustomerAccessNavigationScenario,
  startFixtureServer,
  type RunningFixtureServer,
} from '../src';

let server: RunningFixtureServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('customer access and navigation scenario', () => {
  it('renders the frozen five-tab and recovery contract without provider calls', () => {
    const markup = renderCustomerAccessNavigationScenario();

    expect(markup).toContain('data-scenario-id="customer-access-navigation"');
    expect(markup.match(/role="tab"/gu) ?? []).toHaveLength(5);
    expect(markup).toContain('Checkout is contextual transaction navigation, not a sixth tab.');
    expect(markup).toContain('Location permission denied');
    expect(markup).toContain('Session expired');
    expect(markup).not.toContain('fetch(');
    expect(markup).not.toContain('supabase');
  });

  it('serves the scenario through the deterministic no-store fixture server', async () => {
    server = await startFixtureServer({ port: 0 });

    const response = await fetch(`${server.origin}${CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE}`);
    const markup = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(markup).toContain('Open valid order link');
    expect(markup).toContain('Open unauthorized order link');
  });
});
