import { describe, expect, it } from 'vitest';

import { loadBackendBootstrapConfiguration } from './bootstrap.configuration';

describe('backend bootstrap configuration', () => {
  it('normalizes and deduplicates configured CORS origins', () => {
    const configuration = loadBackendBootstrapConfiguration({
      NODE_ENV: 'production',
      PORT: '8080',
      CORS_ALLOWED_ORIGINS:
        'https://admin.vastra.in, https://merchant.vastra.in/,https://admin.vastra.in',
    });

    expect(configuration).toStrictEqual({
      port: 8080,
      corsAllowedOrigins: ['https://admin.vastra.in', 'https://merchant.vastra.in'],
    });
  });

  it('uses safe local origins outside production', () => {
    expect(loadBackendBootstrapConfiguration({ NODE_ENV: 'test' })).toStrictEqual({
      port: 8080,
      corsAllowedOrigins: ['http://localhost:3000', 'http://localhost:8081'],
    });
  });

  it('requires explicit production origins', () => {
    expect(() => loadBackendBootstrapConfiguration({ NODE_ENV: 'production' })).toThrowError(
      'Invalid environment configuration: CORS_ALLOWED_ORIGINS',
    );
  });

  it.each(['0', '65536', 'not-a-port'])('rejects invalid port %s', (port) => {
    expect(() => loadBackendBootstrapConfiguration({ NODE_ENV: 'test', PORT: port })).toThrowError(
      'Invalid environment configuration: PORT',
    );
  });

  it.each(['*', 'file:///tmp/api', 'https://example.com/path', 'https://user@example.com'])(
    'rejects unsafe CORS origin %s',
    (origin) => {
      expect(() =>
        loadBackendBootstrapConfiguration({
          NODE_ENV: 'production',
          CORS_ALLOWED_ORIGINS: origin,
        }),
      ).toThrowError('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
    },
  );
});
