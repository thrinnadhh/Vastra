import { describe, expect, it } from 'vitest';

import {
  createJsonContentTypeMiddleware,
  createRateLimitMiddleware,
  createRequestIdMiddleware,
  createSecurityHeadersMiddleware,
  isAllowedCorsOrigin,
  loadHttpRuntimeConfiguration,
} from './http-runtime';

class ResponseStub {
  public statusCode = 200;
  public readonly headers = new Map<string, string | number>();
  public body: string | undefined;

  public setHeader(name: string, value: string | number): void {
    this.headers.set(name, value);
  }

  public end(body?: string): void {
    this.body = body;
  }
}

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

  it('allows native requests and only exact configured browser origins', () => {
    const origins = ['https://admin.vastra.example'];
    expect(isAllowedCorsOrigin(undefined, origins)).toBe(true);
    expect(isAllowedCorsOrigin('https://admin.vastra.example', origins)).toBe(true);
    expect(isAllowedCorsOrigin('https://attacker.example', origins)).toBe(false);
  });

  it('sets security and request-correlation headers without trusting malformed IDs', () => {
    const response = new ResponseStub();
    let nextCalls = 0;
    createSecurityHeadersMiddleware(true)({ headers: {} }, response, () => {
      nextCalls += 1;
    });
    createRequestIdMiddleware()({ headers: { 'x-request-id': 'not-a-uuid' } }, response, () => {
      nextCalls += 1;
    });

    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/u);
    expect(nextCalls).toBe(2);
  });

  it('rejects mutation bodies with unsupported media types', () => {
    const response = new ResponseStub();
    let continued = false;

    createJsonContentTypeMiddleware()(
      {
        headers: { 'content-length': '5', 'content-type': 'text/plain' },
        method: 'POST',
      },
      response,
      () => {
        continued = true;
      },
    );

    expect(response.statusCode).toBe(415);
    expect(response.body).toContain('application/json');
    expect(continued).toBe(false);
  });

  it('returns a bounded retry hint after the per-process request limit', () => {
    const middleware = createRateLimitMiddleware(1);
    const request = { headers: {}, ip: '127.0.0.1' };
    const first = new ResponseStub();
    const second = new ResponseStub();

    middleware(request, first, () => undefined);
    middleware(request, second, () => undefined);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTypeOf('number');
  });
});
