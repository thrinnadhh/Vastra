import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPaiseAsInr } from '../checkout/format-inr';
import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import { getCustomerOrderStatusPresentation } from './customer-order-status';
import { CustomerOrderTracking } from './customer-order-tracking';
import type { CustomerOrderTrackingPort } from './customer-order-tracking.types';
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderDetailPort,
  type CustomerOrderHistoryEntry,
  type CustomerOrderItem,
} from './customer-order.types';

interface DetailState {
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
      return 'Your session is no longer available. Sign in again to view this order.';
    case 'FORBIDDEN':
    case 'NOT_FOUND':
      return 'This order is unavailable or does not belong to this account.';
    case 'TRANSPORT':
      return 'Reconnect to load the latest order status and history.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'This order is temporarily unavailable. Please try again.';
    case 'MALFORMED_RESPONSE':
    case 'VALIDATION':
    case 'STALE_QUOTE':
    case 'CONFLICT':
    case 'UNKNOWN':
      return 'We could not load this order. Please try again.';
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function variantLabel(item: CustomerOrderItem): string {
  return [item.colourName, item.sizeLabel, item.sku]
    .filter((value): value is string => value !== null)
    .join(' · ');
}

function HistoryEntry({ entry }: { readonly entry: CustomerOrderHistoryEntry }) {
  const status = getCustomerOrderStatusPresentation(entry.status);
  return (
    <View
      accessible
      accessibilityLabel={`Order update ${status.title} at ${entry.createdAt}`}
      style={styles.historyEntry}
    >
      <View style={styles.timelineDot} />
      <View style={styles.historyCopy}>
        <Text style={styles.historyStatus}>{status.title}</Text>
        <Text style={styles.meta}>{formatDateTime(entry.createdAt)}</Text>
        <Text style={styles.historyNote}>{status.description}</Text>
      </View>
    </View>
  );
}

function OrderDetailContent({
  order,
  onRefresh,
  onBack,
  trackingClient,
}: {
  readonly order: CustomerOrderDetail;
  readonly onRefresh: () => void;
  readonly onBack?: () => void;
  readonly trackingClient?: CustomerOrderTrackingPort;
}) {
  const status = getCustomerOrderStatusPresentation(order.status);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {onBack === undefined ? null : (
        <Pressable
          accessibilityLabel="Back from customer order details"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backAction}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      )}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>ORDER</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {order.orderNumber}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh order details"
          accessibilityRole="button"
          onPress={onRefresh}
          style={styles.refreshAction}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View
        accessible
        accessibilityLabel={`Current order status ${status.title}. ${status.description}`}
        style={styles.card}
      >
        <Text style={styles.sectionLabel}>CURRENT STATUS</Text>
        <Text style={styles.status}>{status.title}</Text>
        <Text style={styles.meta}>{status.description}</Text>
        <Text style={styles.meta}>
          Payment:{' '}
          {order.paymentStatus === 'COD_PENDING' ? 'Cash on delivery pending' : 'Payment updated'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {order.shop.name}
        </Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.meta}>{variantLabel(item)}</Text>
              <Text style={styles.meta}>Quantity {item.quantity}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatPaiseAsInr(item.totalPaise)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Order total</Text>
          <Text
            accessibilityLabel={`Order total ${formatPaiseAsInr(order.totals.totalPaise)}`}
            style={styles.totalValue}
          >
            {formatPaiseAsInr(order.totals.totalPaise)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Delivery snapshot
        </Text>
        <Text style={styles.itemName}>{order.address.recipientName}</Text>
        <Text style={styles.meta}>{order.address.phoneNumber}</Text>
        <Text style={styles.meta}>{order.address.line1}</Text>
        {order.address.line2 === null ? null : (
          <Text style={styles.meta}>{order.address.line2}</Text>
        )}
        <Text style={styles.meta}>
          {order.address.area}, {order.address.city}, {order.address.state}{' '}
          {order.address.postalCode}
        </Text>
      </View>

      <CustomerOrderTracking
        orderId={order.id}
        orderStatus={order.status}
        {...(trackingClient === undefined ? {} : { trackingClient })}
      />

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Status history
        </Text>
        {order.history.map((entry) => (
          <HistoryEntry entry={entry} key={entry.id} />
        ))}
      </View>
    </ScrollView>
  );
}

function ActiveCustomerOrderDetailScreen({
  orderId,
  orderClient,
  onBack,
  trackingClient,
}: {
  readonly orderId: string;
  readonly orderClient: CustomerOrderDetailPort;
  readonly onBack?: () => void;
  readonly trackingClient?: CustomerOrderTrackingPort;
}) {
  const operation = useRef(0);
  const [state, setState] = useState<DetailState>({
    order: null,
    isLoading: true,
    failure: null,
  });

  const runRequest = useCallback(
    (operationId: number) => {
      void orderClient.getOrder(orderId).then(
        (order) => {
          if (operation.current === operationId) {
            setState({ order, isLoading: false, failure: null });
          }
        },
        (error: unknown) => {
          if (operation.current === operationId) {
            setState((current) => ({
              order: current.order,
              isLoading: false,
              failure: toOrderError(error),
            }));
          }
        },
      );
    },
    [orderClient, orderId],
  );

  const refresh = useCallback(() => {
    const operationId = ++operation.current;
    setState((current) => ({ ...current, isLoading: true, failure: null }));
    runRequest(operationId);
  }, [runRequest]);

  useEffect(() => {
    const operationId = ++operation.current;
    runRequest(operationId);
    return () => {
      operation.current += 1;
    };
  }, [runRequest]);

  const networkState = useMemo(
    () =>
      resolveCustomerNetworkState({
        isLoading: state.isLoading,
        isOffline: state.failure?.kind === 'TRANSPORT',
        errorMessage: state.failure === null ? null : failureMessage(state.failure),
        hasData: state.order !== null,
        hasStaleData: state.order !== null && state.failure !== null,
        loadingLabel: 'Loading order details and history',
        emptyTitle: 'Order unavailable',
        emptyMessage: 'This order could not be found.',
        emptyActionLabel: null,
      }),
    [state],
  );

  return (
    <CustomerNetworkStateBoundary onRetry={refresh} state={networkState}>
      {state.order === null ? null : (
        <OrderDetailContent
          {...(onBack === undefined ? {} : { onBack })}
          onRefresh={refresh}
          order={state.order}
          {...(trackingClient === undefined ? {} : { trackingClient })}
        />
      )}
    </CustomerNetworkStateBoundary>
  );
}

export function CustomerOrderDetailScreen({
  orderId,
  orderClient,
  onBack,
  trackingClient,
}: {
  readonly orderId: string;
  readonly orderClient: CustomerOrderDetailPort;
  readonly onBack?: () => void;
  readonly trackingClient?: CustomerOrderTrackingPort;
}) {
  return (
    <ActiveCustomerOrderDetailScreen
      key={orderId}
      {...(onBack === undefined ? {} : { onBack })}
      orderClient={orderClient}
      orderId={orderId}
      {...(trackingClient === undefined ? {} : { trackingClient })}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
  backAction: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#6C3AA8', fontSize: 15, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#6C3AA8', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { marginTop: 5, color: '#1F2937', fontSize: 24, fontWeight: '700' },
  refreshAction: { padding: 10 },
  refreshText: { color: '#6C3AA8', fontSize: 14, fontWeight: '700' },
  card: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: { color: '#667085', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { marginBottom: 12, color: '#1F2937', fontSize: 18, fontWeight: '700' },
  status: { marginTop: 6, color: '#18794E', fontSize: 18, fontWeight: '700' },
  meta: { marginTop: 4, color: '#667085', fontSize: 14, lineHeight: 20 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  itemCopy: { flex: 1, paddingRight: 12 },
  itemName: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  itemTotal: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },
  totalLabel: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  totalValue: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  historyEntry: { flexDirection: 'row', marginTop: 14 },
  timelineDot: { width: 10, height: 10, marginTop: 5, borderRadius: 5, backgroundColor: '#6C3AA8' },
  historyCopy: { flex: 1, marginLeft: 12 },
  historyStatus: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  historyNote: { marginTop: 5, color: '#475467', fontSize: 14, lineHeight: 20 },
});
