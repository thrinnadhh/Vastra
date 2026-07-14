import { resolveCustomerNetworkState } from './resolve-customer-network-state';
import type { ResolveCustomerNetworkStateInput } from './customer-network-state.types';

const baseInput: ResolveCustomerNetworkStateInput = {
  isLoading: false,
  isOffline: false,
  errorMessage: null,
  hasData: true,
  hasStaleData: false,
  loadingLabel: 'Loading products',
  emptyTitle: 'No products yet',
  emptyMessage: 'Try another category.',
  emptyActionLabel: 'Browse categories',
};

describe('resolveCustomerNetworkState', () => {
  it('prioritizes initial loading before other empty states', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      isLoading: true,
      isOffline: true,
      hasData: false,
    });

    expect(state).toStrictEqual({
      kind: 'LOADING',
      accessibilityLabel: 'Loading products',
    });
  });

  it('returns a blocking offline state when no data is available', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      isOffline: true,
      hasData: false,
    });

    expect(state.kind).toBe('OFFLINE');
  });

  it('returns an error state when the request failed without data', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      errorMessage: 'The catalogue could not be loaded.',
      hasData: false,
    });

    expect(state).toStrictEqual({
      kind: 'ERROR',
      title: 'Something went wrong',
      message: 'The catalogue could not be loaded.',
      retryLabel: 'Try again',
    });
  });

  it('returns the caller-defined empty state', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      hasData: false,
    });

    expect(state).toStrictEqual({
      kind: 'EMPTY',
      title: 'No products yet',
      message: 'Try another category.',
      actionLabel: 'Browse categories',
    });
  });

  it('keeps stale data visible while offline', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      isOffline: true,
      hasStaleData: true,
    });

    expect(state).toStrictEqual({
      kind: 'SUCCESS',
      staleReason: 'OFFLINE',
    });
  });

  it('keeps stale data visible after a recoverable refresh error', () => {
    const state = resolveCustomerNetworkState({
      ...baseInput,
      errorMessage: 'Refresh failed.',
      hasStaleData: true,
    });

    expect(state).toStrictEqual({
      kind: 'SUCCESS',
      staleReason: 'ERROR',
    });
  });

  it('returns a clean success state for fresh data', () => {
    expect(resolveCustomerNetworkState(baseInput)).toStrictEqual({
      kind: 'SUCCESS',
      staleReason: null,
    });
  });
});
