import type {
  CustomerNetworkScreenState,
  ResolveCustomerNetworkStateInput,
} from './customer-network-state.types';

const DEFAULT_ERROR_TITLE = 'Something went wrong';
const DEFAULT_OFFLINE_TITLE = 'You are offline';
const DEFAULT_OFFLINE_MESSAGE =
  'Check your internet connection. Saved information remains available where possible.';
const DEFAULT_RETRY_LABEL = 'Try again';

export function resolveCustomerNetworkState(
  input: ResolveCustomerNetworkStateInput,
): CustomerNetworkScreenState {
  if (input.isLoading && !input.hasData) {
    return {
      kind: 'LOADING',
      accessibilityLabel: input.loadingLabel,
    };
  }

  if (input.isOffline && !input.hasData) {
    return {
      kind: 'OFFLINE',
      title: DEFAULT_OFFLINE_TITLE,
      message: DEFAULT_OFFLINE_MESSAGE,
      retryLabel: DEFAULT_RETRY_LABEL,
    };
  }

  if (input.errorMessage !== null && !input.hasData) {
    return {
      kind: 'ERROR',
      title: DEFAULT_ERROR_TITLE,
      message: input.errorMessage,
      retryLabel: DEFAULT_RETRY_LABEL,
    };
  }

  if (!input.hasData) {
    return {
      kind: 'EMPTY',
      title: input.emptyTitle,
      message: input.emptyMessage,
      actionLabel: input.emptyActionLabel,
    };
  }

  if (input.isOffline && input.hasStaleData) {
    return {
      kind: 'SUCCESS',
      staleReason: 'OFFLINE',
    };
  }

  if (input.errorMessage !== null && input.hasStaleData) {
    return {
      kind: 'SUCCESS',
      staleReason: 'ERROR',
    };
  }

  return {
    kind: 'SUCCESS',
    staleReason: null,
  };
}
