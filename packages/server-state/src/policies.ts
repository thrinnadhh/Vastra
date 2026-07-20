import { QueryClient } from '@tanstack/react-query';

export type CachePolicyClass = 'CATALOGUE' | 'PERSONAL' | 'TRANSACTION' | 'LIVE';

export interface CachePolicy {
  readonly staleTime: number;
  readonly gcTime: number;
  readonly refetchOnMount: true;
  readonly refetchOnWindowFocus: true;
  readonly refetchOnReconnect: true;
}

const policy = (staleTime: number, gcTime: number): CachePolicy =>
  Object.freeze({
    staleTime,
    gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

export const CACHE_POLICIES: Readonly<Record<CachePolicyClass, CachePolicy>> = Object.freeze({
  CATALOGUE: policy(60_000, 600_000),
  PERSONAL: policy(30_000, 600_000),
  TRANSACTION: policy(0, 300_000),
  LIVE: policy(0, 60_000),
});

export function createEphemeralQuotePolicy(expiresAt: string, now = Date.now()): CachePolicy {
  const expiration = Date.parse(expiresAt);
  if (!Number.isFinite(expiration)) throw new TypeError('Quote expiry must be an ISO timestamp');
  return policy(0, Math.max(0, Math.min(300_000, expiration - now)));
}

export type RetryPolicyErrorKind =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TRANSPORT'
  | 'TIMEOUT'
  | 'API'
  | 'CONTRACT'
  | 'UNKNOWN';

export interface RetryPolicyError {
  readonly kind: RetryPolicyErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;
}

export type ReadRetryClass = 'STANDARD' | 'LIVE';
export type ReadRetryPolicy = (failureCount: number, error: RetryPolicyError) => boolean;

function isRetryableReadFailure(error: RetryPolicyError): boolean {
  if (!error.retryable) return false;
  if (error.kind === 'TRANSPORT' || error.kind === 'TIMEOUT') return true;
  return error.kind === 'API' && error.status !== null && error.status >= 500;
}

export function createReadRetryPolicy(retryClass: ReadRetryClass): ReadRetryPolicy {
  if (retryClass === 'LIVE') return () => false;
  return (failureCount, error) => {
    if (error.kind === 'RATE_LIMIT') {
      return (
        error.retryable &&
        failureCount < 1 &&
        error.retryAfterMs !== null &&
        error.retryAfterMs >= 0 &&
        error.retryAfterMs <= 30_000
      );
    }
    return failureCount < 2 && isRetryableReadFailure(error);
  };
}

export function readRetryDelay(
  failureCount: number,
  error: RetryPolicyError,
  random: () => number = Math.random,
): number {
  if (error.kind === 'RATE_LIMIT' && error.retryAfterMs !== null) return error.retryAfterMs;
  const maximum = Math.min(4_000, 500 * 2 ** Math.max(0, failureCount));
  return Math.floor(Math.max(0, Math.min(1, random())) * maximum);
}

export const MUTATION_POLICY = Object.freeze({
  retry: false,
  networkMode: 'always' as const,
});

export const QUERY_CLIENT_POLICY = Object.freeze({
  queries: Object.freeze({
    ...CACHE_POLICIES.TRANSACTION,
    networkMode: 'online' as const,
    retry: createReadRetryPolicy('STANDARD'),
    retryDelay: readRetryDelay,
  }),
  mutations: MUTATION_POLICY,
});

export function createVastraQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: QUERY_CLIENT_POLICY,
  });
}
