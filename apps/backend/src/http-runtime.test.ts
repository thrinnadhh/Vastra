import { describe, expect, it } from 'vitest';

import { loadHttpRuntimeConfiguration } from './http-runtime';

describe('HTTP runtime configuration', () => {
  it('requires an explicit browser origin allowlist in production', () => {
    expect(() =>
      loadHttpRuntimeConfiguration({
        NODE_ENV: 'production',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('parses bounded production controls and exact origins', () => {
    expect(
      loadHttpRuntimeConfiguration({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://admin.vastra.example,https://customer.vastra.example',
        HTTP_BODY_LIMIT_KB: '128',
        HTTP_RATE_LIMIT_MAX: '300',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toStrictEqual({
      allowedOrigins: ['https://admin.vastra.example', 'https://customer.vastra.example'],
      bodyLimit: '128kb',
      rateLimitMax: 300,
      trustProxyHops: 1,
      production: true,
    });
  });

  it('rejects wildcard origins and unsafe runtime limits', () => {
    expect(() =>
      loadHttpRuntimeConfiguration({
        CORS_ALLOWED_ORIGINS: '*',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS');
    expect(() =>
      loadHttpRuntimeConfiguration({
        HTTP_BODY_LIMIT_KB: '4096',
      }),
    ).toThrow('HTTP_BODY_LIMIT_KB');
  });
});
