export type CustomerStaleReason = 'OFFLINE' | 'ERROR';

export type CustomerNetworkScreenState =
  | {
      readonly kind: 'LOADING';
      readonly accessibilityLabel: string;
    }
  | {
      readonly kind: 'EMPTY';
      readonly title: string;
      readonly message: string;
      readonly actionLabel: string | null;
    }
  | {
      readonly kind: 'ERROR';
      readonly title: string;
      readonly message: string;
      readonly retryLabel: string;
    }
  | {
      readonly kind: 'OFFLINE';
      readonly title: string;
      readonly message: string;
      readonly retryLabel: string;
    }
  | {
      readonly kind: 'SUCCESS';
      readonly staleReason: CustomerStaleReason | null;
    };

export interface ResolveCustomerNetworkStateInput {
  readonly isLoading: boolean;
  readonly isOffline: boolean;
  readonly errorMessage: string | null;
  readonly hasData: boolean;
  readonly hasStaleData: boolean;
  readonly loadingLabel: string;
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly emptyActionLabel: string | null;
}
