import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPaiseAsInr } from '../checkout/format-inr';
import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import { getCustomerOrderStatusPresentation } from './customer-order-status';
import {
  CustomerOrderError,
  type CustomerOrderSummary,
  type CustomerOrdersListPort,
} from './customer-order.types';

interface CustomerOrdersScreenProps {
  readonly ordersClient: CustomerOrdersListPort;
  readonly onSelectOrder: (orderId: string) => void;
}

interface OrdersState {
  readonly orders: readonly CustomerOrderSummary[] | null;
  readonly nextCursor: string | null;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
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
      return 'Your session is no longer available. Sign in again to view your orders.';
    case 'FORBIDDEN':
      return 'This account is not allowed to read these orders.';
    case 'TRANSPORT':
      return 'Reconnect to load your latest orders.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Your orders are temporarily unavailable. Please try again.';
    case 'MALFORMED_RESPONSE':
    case 'VALIDATION':
    case 'STALE_QUOTE':
    case 'CONFLICT':
    case 'NOT_FOUND':
    case 'UNKNOWN':
      return 'We could not load your orders. Please try again.';
  }
}

function formatPlacedAt(order: CustomerOrderSummary): string {
  return new Date(order.placedAt ?? order.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function OrderCard({
  order,
  onSelect,
}: {
  readonly order: CustomerOrderSummary;
  readonly onSelect: (orderId: string) => void;
}) {
  const status = getCustomerOrderStatusPresentation(order.status);
  return (
    <Pressable
      accessibilityLabel={`Open order ${order.orderNumber}`}
      accessibilityRole="button"
      onPress={() => {
        onSelect(order.id);
      }}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.shopName}>{order.shop.name}</Text>
        </View>
        <Text accessibilityLabel={`Order status ${status.title}`} style={styles.status}>
          {status.title}
        </Text>
      </View>
      <Text style={styles.meta}>
        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {formatPlacedAt(order)}
      </Text>
      <Text
        accessibilityLabel={`Order total ${formatPaiseAsInr(order.totals.totalPaise)}`}
        style={styles.total}
      >
        {formatPaiseAsInr(order.totals.totalPaise)}
      </Text>
    </Pressable>
  );
}

function OrdersSection({
  title,
  orders,
  onSelectOrder,
}: {
  readonly title: string;
  readonly orders: readonly CustomerOrderSummary[];
  readonly onSelectOrder: (orderId: string) => void;
}) {
  if (orders.length === 0) {
    return null;
  }
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {orders.map((order) => (
        <OrderCard key={order.id} onSelect={onSelectOrder} order={order} />
      ))}
    </View>
  );
}

export function CustomerOrdersScreen({ ordersClient, onSelectOrder }: CustomerOrdersScreenProps) {
  const operation = useRef(0);
  const [state, setState] = useState<OrdersState>({
    orders: null,
    nextCursor: null,
    isLoading: true,
    isLoadingMore: false,
    failure: null,
  });

  const runFirstPage = useCallback(
    (operationId: number) => {
      void ordersClient.listOrders({ limit: 20 }).then(
        (page) => {
          if (operation.current === operationId) {
            setState({
              orders: page.orders,
              nextCursor: page.nextCursor,
              isLoading: false,
              isLoadingMore: false,
              failure: null,
            });
          }
        },
        (error: unknown) => {
          if (operation.current === operationId) {
            setState((current) => ({
              ...current,
              isLoading: false,
              isLoadingMore: false,
              failure: toOrderError(error),
            }));
          }
        },
      );
    },
    [ordersClient],
  );

  const loadFirstPage = useCallback(() => {
    const operationId = ++operation.current;
    setState((current) => ({ ...current, isLoading: true, failure: null }));
    runFirstPage(operationId);
  }, [runFirstPage]);

  useEffect(() => {
    const operationId = ++operation.current;
    runFirstPage(operationId);
    return () => {
      operation.current += 1;
    };
  }, [runFirstPage]);

  const loadMore = useCallback(() => {
    if (state.nextCursor === null || state.isLoadingMore) {
      return;
    }
    const operationId = ++operation.current;
    const cursor = state.nextCursor;
    setState((current) => ({ ...current, isLoadingMore: true, failure: null }));
    void ordersClient.listOrders({ cursor, limit: 20 }).then(
      (page) => {
        if (operation.current === operationId) {
          setState((current) => {
            const existing = current.orders ?? [];
            const knownIds = new Set(existing.map((order) => order.id));
            return {
              orders: [...existing, ...page.orders.filter((order) => !knownIds.has(order.id))],
              nextCursor: page.nextCursor,
              isLoading: false,
              isLoadingMore: false,
              failure: null,
            };
          });
        }
      },
      (error: unknown) => {
        if (operation.current === operationId) {
          setState((current) => ({
            ...current,
            isLoadingMore: false,
            failure: toOrderError(error),
          }));
        }
      },
    );
  }, [ordersClient, state.isLoadingMore, state.nextCursor]);

  const orders = useMemo(() => state.orders ?? [], [state.orders]);
  const activeOrders = useMemo(
    () => orders.filter((order) => !getCustomerOrderStatusPresentation(order.status).terminal),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => getCustomerOrderStatusPresentation(order.status).terminal),
    [orders],
  );
  const networkState = useMemo(
    () =>
      resolveCustomerNetworkState({
        isLoading: state.isLoading,
        isOffline: state.failure?.kind === 'TRANSPORT',
        errorMessage: state.failure === null ? null : failureMessage(state.failure),
        hasData: orders.length > 0,
        hasStaleData: orders.length > 0 && state.failure !== null,
        loadingLabel: 'Loading your orders',
        emptyTitle: 'No orders yet',
        emptyMessage: 'Your Vastra orders will appear here after checkout.',
        emptyActionLabel: null,
      }),
    [orders.length, state.failure, state.isLoading],
  );

  return (
    <CustomerNetworkStateBoundary onRetry={loadFirstPage} state={networkState}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={loadFirstPage} refreshing={state.isLoading} />}
      >
        <Text accessibilityRole="header" style={styles.title}>
          My orders
        </Text>
        <Pressable
          accessibilityLabel="Refresh my orders"
          accessibilityRole="button"
          onPress={loadFirstPage}
          style={styles.refreshAction}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
        <OrdersSection onSelectOrder={onSelectOrder} orders={activeOrders} title="Active" />
        <OrdersSection onSelectOrder={onSelectOrder} orders={pastOrders} title="Past" />
        {state.nextCursor === null ? null : (
          <Pressable
            accessibilityLabel="Load more orders"
            accessibilityRole="button"
            accessibilityState={{ disabled: state.isLoadingMore }}
            disabled={state.isLoadingMore}
            onPress={loadMore}
            style={styles.loadMore}
          >
            <Text style={styles.loadMoreText}>
              {state.isLoadingMore ? 'Loading more…' : 'Load more'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </CustomerNetworkStateBoundary>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '700' },
  refreshAction: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8 },
  refreshText: { color: '#6C3AA8', fontSize: 14, fontWeight: '700' },
  section: { marginTop: 22 },
  sectionTitle: { color: '#1F2937', fontSize: 20, fontWeight: '700' },
  card: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardCopy: { flex: 1, paddingRight: 12 },
  orderNumber: { color: '#6C3AA8', fontSize: 13, fontWeight: '700' },
  shopName: { marginTop: 4, color: '#1F2937', fontSize: 17, fontWeight: '700' },
  status: { color: '#18794E', fontSize: 11, fontWeight: '700' },
  meta: { marginTop: 10, color: '#667085', fontSize: 14 },
  total: { marginTop: 8, color: '#1F2937', fontSize: 16, fontWeight: '700' },
  loadMore: { alignItems: 'center', marginTop: 20, padding: 14 },
  loadMoreText: { color: '#6C3AA8', fontSize: 15, fontWeight: '700' },
});
