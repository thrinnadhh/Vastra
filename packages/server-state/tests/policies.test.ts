import { describe, expect, it } from 'vitest';

import {
  CACHE_POLICIES,
  MUTATION_POLICY,
  OfflineMutationError,
  assertMutationOnline,
  createEphemeralQuotePolicy,
  createReadRetryPolicy,
  createVastraQueryClient,
  readRetryDelay,
  type ConnectivityPort,
  type RetryPolicyError,
} from '../src/index';

const error = (overrides: Partial<RetryPolicyError>): RetryPolicyError => ({
  kind: 'API',
  status: 503,
  retryable: true,
  retryAfterMs: null,
  ...overrides,
});

describe('server-state policies', () => {
  it('implements every frozen stale and garbage-collection class', () => {
    expect(CACHE_POLICIES.CATALOGUE.staleTime).toBe(60_000);
    expect(CACHE_POLICIES.CATALOGUE.gcTime).toBe(600_000);
    expect(CACHE_POLICIES.PERSONAL.staleTime).toBe(30_000);
    expect(CACHE_POLICIES.PERSONAL.gcTime).toBe(600_000);
    expect(CACHE_POLICIES.TRANSACTION.staleTime).toBe(0);
    expect(CACHE_POLICIES.TRANSACTION.gcTime).toBe(300_000);
    expect(CACHE_POLICIES.LIVE.staleTime).toBe(0);
    expect(CACHE_POLICIES.LIVE.gcTime).toBe(60_000);
    expect(
      createEphemeralQuotePolicy('2026-07-21T10:02:00.000Z', Date.parse('2026-07-21T10:00:00Z')),
    ).toEqual(expect.objectContaining({ staleTime: 0, gcTime: 120_000 }));
    expect(
      createEphemeralQuotePolicy('2026-07-21T11:00:00.000Z', Date.parse('2026-07-21T10:00:00Z')),
    ).toEqual(expect.objectContaining({ staleTime: 0, gcTime: 300_000 }));
  });

  it('uses one safe QueryClient policy and never retries or pauses mutations', () => {
    const client = createVastraQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries).toEqual(
      expect.objectContaining({ staleTime: 0, gcTime: 300_000, networkMode: 'online' }),
    );
    expect(defaults.mutations).toEqual(
      expect.objectContaining({ retry: false, networkMode: 'always' }),
    );
    expect(MUTATION_POLICY).toEqual({ retry: false, networkMode: 'always' });
  });

  it('caps normal reads at two retries and disables inner LIVE retries', () => {
    const standard = createReadRetryPolicy('STANDARD');
    const live = createReadRetryPolicy('LIVE');

    expect(standard(0, error({ kind: 'TRANSPORT', status: null }))).toBe(true);
    expect(standard(1, error({ kind: 'TIMEOUT', status: null }))).toBe(true);
    expect(standard(2, error({}))).toBe(false);
    expect(live(0, error({}))).toBe(false);
    expect(standard(0, error({ kind: 'AUTHENTICATION', status: 401 }))).toBe(false);
    expect(standard(0, error({ kind: 'CONFLICT', status: 409 }))).toBe(false);
    expect(standard(0, error({ retryable: false }))).toBe(false);
  });

  it('allows one bounded rate-limit retry and uses bounded full-jitter delay', () => {
    const retry = createReadRetryPolicy('STANDARD');
    const boundedRateLimit = error({ kind: 'RATE_LIMIT', status: 429, retryAfterMs: 5_000 });

    expect(retry(0, boundedRateLimit)).toBe(true);
    expect(retry(1, boundedRateLimit)).toBe(false);
    expect(retry(0, error({ kind: 'RATE_LIMIT', status: 429, retryAfterMs: 30_001 }))).toBe(false);
    expect(readRetryDelay(0, error({}), () => 1)).toBe(500);
    expect(readRetryDelay(4, error({}), () => 1)).toBe(4_000);
    expect(readRetryDelay(0, boundedRateLimit, () => 0)).toBe(5_000);
  });

  it('blocks known-offline writes but lets unknown connectivity fail visibly', async () => {
    const connectivity = (status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'): ConnectivityPort => ({
      getCurrentStatus: () => Promise.resolve(status),
      subscribe: () => () => undefined,
    });

    await expect(assertMutationOnline(connectivity('OFFLINE'))).rejects.toBeInstanceOf(
      OfflineMutationError,
    );
    await expect(assertMutationOnline(connectivity('UNKNOWN'))).resolves.toBeUndefined();
    await expect(assertMutationOnline(connectivity('ONLINE'))).resolves.toBeUndefined();
  });
});
