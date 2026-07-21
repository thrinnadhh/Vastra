import { describe, expect, it } from 'vitest';

import { createLocalError, normalizeHttpError, parseRetryAfterMs } from '../src/errors.js';
import { errorPayload } from './fixtures.js';

describe('normalized API errors', () => {
  it.each([
    [401, 'AUTHENTICATION'],
    [403, 'AUTHORIZATION'],
    [400, 'VALIDATION'],
    [422, 'VALIDATION'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [410, 'CONFLICT'],
    [429, 'RATE_LIMIT'],
    [500, 'API'],
  ])('maps HTTP %i to %s', (status: number, kind: string) => {
    const normalized = normalizeHttpError({
      operationId: 'testOperation',
      status,
      payload: errorPayload('SAFE_CODE', { retryable: true }),
      method: 'GET',
      retryAfter: status === 429 ? '3' : null,
    });
    expect(normalized.kind).toBe(kind);
    expect(normalized.code).toBe('SAFE_CODE');
  });

  it('bounds Retry-After seconds and HTTP dates to thirty seconds', () => {
    expect(parseRetryAfterMs('5', 0)).toBe(5_000);
    expect(parseRetryAfterMs('31', 0)).toBeNull();
    expect(parseRetryAfterMs(new Date(20_000).toUTCString(), 0)).toBe(20_000);
    expect(parseRetryAfterMs(new Date(40_000).toUTCString(), 0)).toBeNull();
    expect(parseRetryAfterMs('invalid', 0)).toBeNull();
    expect(parseRetryAfterMs(null, 0)).toBeNull();
  });

  it('never automatically retries mutations and requires refresh for unknown material outcomes', () => {
    const apiFailure = normalizeHttpError({
      operationId: 'placeOrder',
      status: 503,
      payload: errorPayload('PROVIDER_UNAVAILABLE', { retryable: true }),
      method: 'POST',
    });
    expect(apiFailure.retryable).toBe(false);
    expect(apiFailure.requiresAuthoritativeRefresh).toBe(true);

    const transport = createLocalError('TRANSPORT', 'placeOrder', true);
    const timeout = createLocalError('TIMEOUT', 'placeOrder', true);
    expect(transport.retryable).toBe(false);
    expect(timeout.requiresAuthoritativeRefresh).toBe(true);
  });

  it('rejects unsafe codes, request IDs, and unallowlisted field errors', () => {
    const normalized = normalizeHttpError({
      operationId: 'updateProfile',
      status: 422,
      payload: {
        success: false,
        error: {
          code: 'unsafe code with spaces',
          message: 'raw',
          details: {
            name: ['Safe'],
            address: ['Sensitive'],
          },
        },
        requestId: 'unsafe/request/id',
      },
      method: 'POST',
      allowedFieldErrors: ['name'],
    });

    expect(normalized.code).toBeNull();
    expect(normalized.requestId).toBeNull();
    expect(normalized.fieldErrors).toEqual({ name: ['Safe'] });
  });

  it('applies the read retry upper bound and server retryable veto', () => {
    const retryable = normalizeHttpError({
      operationId: 'listOrders',
      status: 503,
      payload: errorPayload('TEMPORARY', { retryable: true }),
      method: 'GET',
    });
    const vetoed = normalizeHttpError({
      operationId: 'listOrders',
      status: 503,
      payload: errorPayload('PERMANENT', { retryable: false }),
      method: 'GET',
    });
    expect(retryable.retryable).toBe(true);
    expect(vetoed.retryable).toBe(false);
  });
});
