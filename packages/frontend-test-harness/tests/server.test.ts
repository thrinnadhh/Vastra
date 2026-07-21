import { afterEach, describe, expect, it } from 'vitest';

import { startFixtureServer, type RunningFixtureServer } from '../src';

let server: RunningFixtureServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('frontend fixture server', () => {
  it('serves a deterministic health boundary and fixture index', async () => {
    server = await startFixtureServer({ port: 0 });

    const health = await fetch(`${server.origin}/health`);
    expect(health.status).toBe(200);
    const payload: unknown = await health.json();
    expect(payload).toMatchObject({ status: 'ok', fixtureCount: 9 });

    const index = await fetch(server.origin);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('Vastra frontend fixtures');
  });

  it('serves semantic mobile/admin fixture pages and rejects unknown fixtures', async () => {
    server = await startFixtureServer({ port: 0 });

    const mobile = await fetch(`${server.origin}/fixtures/mobile-merchant-shell`);
    expect(await mobile.text()).toContain('data-mode="commerce"');

    const admin = await fetch(`${server.origin}/fixtures/admin-overview-shell`);
    const adminMarkup = await admin.text();
    expect(adminMarkup).toContain('Skip to main content');
    expect(adminMarkup).toContain('aria-label="Admin navigation"');
    expect(adminMarkup).toContain('id="admin-main-content"');

    const missing = await fetch(`${server.origin}/fixtures/not-real`);
    expect(missing.status).toBe(404);
  });
});
