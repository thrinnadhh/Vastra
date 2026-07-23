import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import { ApiCustomerOrderAdapter } from './api-customer-order.adapter';
import { CustomerOrderConfirmationScreen } from './customer-order-confirmation.screen';
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderDetailPort,
} from './customer-order.types';

interface ConfirmationState {
  readonly order: CustomerOrderDetail | null;
  readonly isLoading: boolean;
  readonly failure: CustomerOrderError | null;
}

function toOrderError(error: unknown): CustomerOrderError {
  return error instanceof CustomerOrderError
    ? error
    : new CustomerOrderError('UNKNOWN', null, false);
}

function failureMessage(error: CustomerOrderError): string {
  switch (error.kind) {
    case 'AUTHENTICATION':
      return 'Your session expired. Sign in again to view the confirmed order.';
    case 'FORBIDDEN':
    case 'NOT_FOUND':
      return 'This confirmed order is unavailable for the current account.';
    case 'TRANSPORT':
      return 'Reconnect to load the confirmed order from Vastra.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'The confirmed order is temporarily unavailable. Please try again.';
    case 'VALIDATION':
    case 'STALE_QUOTE':
    case 'CONFLICT':
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'Vastra could not safely load this confirmed order.';
  }
}

function isSecurityFailure(error: CustomerOrderError): boolean {
  return (
    error.kind === 'AUTHENTICATION' || error.kind === 'FORBIDDEN' || error.kind === 'NOT_FOUND'
  );
}

function matchesExpectedTransaction(
  order: CustomerOrderDetail,
  expected: {
    readonly orderId: string;
    readonly cartId?: string | null;
    readonly quoteId?: string | null;
    readonly addressId?: string | null;
  },
): boolean {
  return (
    order.id === expected.orderId &&
    (expected.cartId == null || order.cartId === expected.cartId) &&
    (expected.quoteId == null || order.quoteId === expected.quoteId) &&
    (expected.addressId == null || order.address.id === expected.addressId)
  );
}

export function CustomerOrderConfirmationRoute({
  orderId,
  expectedCartId,
  expectedQuoteId,
  expectedAddressId,
  orderClient,
  onViewOrder,
  onViewOrders,
  onContinueShopping,
  onSecurityFailure,
}: {
  readonly orderId: string;
  readonly expectedCartId?: string | null;
  readonly expectedQuoteId?: string | null;
  readonly expectedAddressId?: string | null;
  readonly orderClient: CustomerOrderDetailPort;
  readonly onViewOrder: (orderId: string) => void;
  readonly onViewOrders: () => void;
  readonly onContinueShopping: () => void;
  readonly onSecurityFailure: () => void;
}) {
  const operation = useRef(0);
  const [state, setState] = useState<ConfirmationState>({
    order: null,
    isLoading: true,
    failure: null,
  });

  const load = useCallback(() => {
    const operationId = ++operation.current;
    setState({ order: null, isLoading: true, failure: null });
    void orderClient.getOrder(orderId).then(
      (order) => {
        if (operation.current !== operationId) return;
        if (
          !matchesExpectedTransaction(order, {
            orderId,
            ...(expectedCartId === undefined ? {} : { cartId: expectedCartId }),
            ...(expectedQuoteId === undefined ? {} : { quoteId: expectedQuoteId }),
            ...(expectedAddressId === undefined ? {} : { addressId: expectedAddressId }),
          })
        ) {
          setState({
            order: null,
            isLoading: false,
            failure: new CustomerOrderError('FORBIDDEN', null, false),
          });
          onSecurityFailure();
          return;
        }
        setState({ order, isLoading: false, failure: null });
      },
      (error: unknown) => {
        if (operation.current !== operationId) return;
        const failure = toOrderError(error);
        setState({ order: null, isLoading: false, failure });
        if (isSecurityFailure(failure)) onSecurityFailure();
      },
    );
  }, [
    expectedAddressId,
    expectedCartId,
    expectedQuoteId,
    onSecurityFailure,
    orderClient,
    orderId,
  ]);

  useEffect(() => {
    load();
    return () => {
      operation.current += 1;
    };
  }, [load]);

  const networkState = useMemo(
    () =>
      resolveCustomerNetworkState({
        isLoading: state.isLoading,
        isOffline: state.failure?.kind === 'TRANSPORT',
        errorMessage: state.failure === null ? null : failureMessage(state.failure),
        hasData: state.order !== null,
        hasStaleData: false,
        loadingLabel: 'Loading confirmed order details',
        emptyTitle: 'Confirmed order unavailable',
        emptyMessage: 'This order could not be verified for the current account.',
        emptyActionLabel: null,
      }),
    [state],
  );

  return (
    <CustomerNetworkStateBoundary onRetry={load} state={networkState}>
      {state.order === null ? null : (
        <CustomerOrderConfirmationScreen
          onContinueShopping={onContinueShopping}
          onViewOrder={onViewOrder}
          onViewOrders={onViewOrders}
          order={state.order}
        />
      )}
    </CustomerNetworkStateBoundary>
  );
}

export function DefaultCustomerOrderConfirmation({
  orderId,
  expectedCartId,
  expectedQuoteId,
  expectedAddressId,
  onViewOrder,
  onViewOrders,
  onContinueShopping,
  onSecurityFailure,
}: {
  readonly orderId: string;
  readonly expectedCartId?: string | null;
  readonly expectedQuoteId?: string | null;
  readonly expectedAddressId?: string | null;
  readonly onViewOrder: (orderId: string) => void;
  readonly onViewOrders: () => void;
  readonly onContinueShopping: () => void;
  readonly onSecurityFailure: () => void;
}) {
  const apiClient = useCustomerApiClient();
  const orderClient = useMemo(() => new ApiCustomerOrderAdapter(apiClient), [apiClient]);

  return (
    <CustomerOrderConfirmationRoute
      onContinueShopping={onContinueShopping}
      onSecurityFailure={onSecurityFailure}
      onViewOrder={onViewOrder}
      onViewOrders={onViewOrders}
      orderClient={orderClient}
      orderId={orderId}
      {...(expectedCartId === undefined ? {} : { expectedCartId })}
      {...(expectedQuoteId === undefined ? {} : { expectedQuoteId })}
      {...(expectedAddressId === undefined ? {} : { expectedAddressId })}
    />
  );
}
