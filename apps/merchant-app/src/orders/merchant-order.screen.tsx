import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPaiseAsInr } from './format-inr';
import { MerchantOrderDecisionActions } from './merchant-order-decision.screen';
import { MerchantOrderPackingActions } from './merchant-order-packing.screen';
import {
  groupMerchantOrderStatus,
  MerchantOrderError,
  type MerchantOrderDetail,
  type MerchantOrderDecisionPort,
  type MerchantOrderGroup,
  type MerchantOrderPackingPort,
  type MerchantOrderReadPort,
  type MerchantOrderSummary,
} from './merchant-order.types';

const GROUPS: readonly MerchantOrderGroup[] = [
  'New',
  'Accepted',
  'Packing',
  'Ready',
  'Completed',
  'Rejected',
];

interface QueueState {
  readonly orders: readonly MerchantOrderSummary[];
  readonly nextCursor: string | null;
  readonly isLoading: boolean;
  readonly isStale: boolean;
  readonly failure: MerchantOrderError | null;
}

function asMerchantError(error: unknown): MerchantOrderError {
  return error instanceof MerchantOrderError
    ? error
    : new MerchantOrderError('UNKNOWN', null, false);
}

function errorMessage(error: MerchantOrderError): string {
  switch (error.kind) {
    case 'TRANSPORT':
      return 'You appear to be offline. Reconnect and retry to see current shop orders.';
    case 'AUTHENTICATION':
      return 'Your merchant session expired. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'This account cannot read orders for this shop.';
    case 'NOT_FOUND':
      return 'This order is not available for your shop.';
    case 'INVALID_STATE':
      return 'The order changed on the server. Refresh to continue.';
    case 'VALIDATION':
      return 'The order request was invalid. Refresh the queue and try again.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Merchant orders are temporarily unavailable. Please retry.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not verify the latest merchant order data.';
  }
}

function formatDate(value: string | null): string {
  if (value === null) return 'Not placed';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function OrderCard({
  order,
  onOpen,
}: {
  readonly order: MerchantOrderSummary;
  readonly onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open order ${order.orderNumber} for ${order.customerName}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.total}>{formatPaiseAsInr(order.totals.totalPaise)}</Text>
      </View>
      <Text style={styles.customer}>{order.customerName}</Text>
      <Text style={styles.meta}>
        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {formatDate(order.placedAt)}
      </Text>
      <Text style={styles.status}>{order.status.replaceAll('_', ' ')}</Text>
    </Pressable>
  );
}

export function MerchantOrderDetailView({
  order,
  onBack,
  onRefresh,
  isRefreshing,
  failure,
  footer,
}: {
  readonly order: MerchantOrderDetail;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly isRefreshing: boolean;
  readonly failure: MerchantOrderError | null;
  readonly footer?: ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable
        accessibilityLabel="Back to merchant orders"
        accessibilityRole="button"
        onPress={onBack}
      >
        <Text style={styles.link}>‹ Orders</Text>
      </Pressable>
      <Text style={styles.eyebrow}>ORDER REVIEW</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {order.orderNumber}
      </Text>
      <Text style={styles.subtitle}>{order.status.replaceAll('_', ' ')}</Text>

      {failure !== null ? (
        <View
          accessible
          accessibilityLabel={`Stale order. ${errorMessage(failure)}`}
          style={styles.warning}
        >
          <Text style={styles.warningTitle}>Showing saved order</Text>
          <Text style={styles.warningCopy}>{errorMessage(failure)}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Customer and delivery
        </Text>
        <Text style={styles.customer}>{order.address.recipientName}</Text>
        <Text style={styles.meta}>{order.address.phoneNumber}</Text>
        <Text style={styles.meta}>
          {order.address.line1}, {order.address.area}, {order.address.city}{' '}
          {order.address.postalCode}
        </Text>
        {order.customerNote === null ? null : (
          <Text style={styles.note}>Note: {order.customerNote}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Items
        </Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.customer}>{item.productName}</Text>
              <Text style={styles.meta}>
                {[item.colourName, item.sizeLabel, item.sku].filter(Boolean).join(' · ')} · Qty{' '}
                {item.quantity}
              </Text>
            </View>
            <Text style={styles.total}>{formatPaiseAsInr(item.totalPaise)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            COD total
          </Text>
          <Text style={styles.total}>{formatPaiseAsInr(order.totals.totalPaise)}</Text>
        </View>
        <Text style={styles.meta}>Payment status: {order.paymentStatus.replaceAll('_', ' ')}</Text>
      </View>

      {footer}

      <Pressable
        accessibilityLabel="Refresh merchant order details"
        accessibilityRole="button"
        disabled={isRefreshing}
        onPress={onRefresh}
        style={[styles.secondaryAction, isRefreshing ? styles.disabled : null]}
      >
        <Text style={styles.secondaryActionText}>
          {isRefreshing ? 'Refreshing…' : 'Refresh order'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MerchantOrderDetailScreen({
  orderId,
  orderClient,
  decisionClient,
  packingClient,
  onBack,
}: {
  readonly orderId: string;
  readonly orderClient: MerchantOrderReadPort;
  readonly decisionClient?: MerchantOrderDecisionPort;
  readonly packingClient?: MerchantOrderPackingPort;
  readonly onBack: () => void;
}) {
  const [order, setOrder] = useState<MerchantOrderDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [failure, setFailure] = useState<MerchantOrderError | null>(null);
  const operation = useRef(0);

  const refresh = useCallback(() => {
    const operationId = ++operation.current;
    setLoading(true);
    setFailure(null);
    void orderClient.getOrder(orderId).then(
      (result) => {
        if (operation.current === operationId) {
          setOrder(result);
          setFailure(null);
          setLoading(false);
        }
      },
      (error: unknown) => {
        if (operation.current === operationId) {
          setFailure(asMerchantError(error));
          setLoading(false);
        }
      },
    );
  }, [orderClient, orderId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    return () => {
      operation.current += 1;
    };
  }, [refresh]);

  if (order === null && isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading merchant order" />
      </View>
    );
  }
  if (order === null && failure !== null) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.title}>
          Order unavailable
        </Text>
        <Text style={styles.centerCopy}>{errorMessage(failure)}</Text>
        <Pressable
          accessibilityLabel="Retry merchant order details"
          accessibilityRole="button"
          onPress={refresh}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Retry</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Back to merchant orders"
          accessibilityRole="button"
          onPress={onBack}
        >
          <Text style={styles.link}>Back to orders</Text>
        </Pressable>
      </View>
    );
  }
  if (order === null) return null;
  return (
    <MerchantOrderDetailView
      failure={failure}
      footer={
        decisionClient === undefined && packingClient === undefined ? undefined : (
          <>
            {decisionClient === undefined ? null : (
              <MerchantOrderDecisionActions
                decisionClient={decisionClient}
                onDecisionComplete={refresh}
                order={order}
              />
            )}
            {packingClient === undefined ? null : (
              <MerchantOrderPackingActions
                onOrderChanged={refresh}
                order={order}
                packingClient={packingClient}
              />
            )}
          </>
        )
      }
      isRefreshing={isLoading}
      onBack={onBack}
      onRefresh={refresh}
      order={order}
    />
  );
}

export function MerchantOrderQueueScreen({
  orderClient,
  decisionClient,
  packingClient,
  pollIntervalMs = 15_000,
}: {
  readonly orderClient: MerchantOrderReadPort;
  readonly decisionClient?: MerchantOrderDecisionPort;
  readonly packingClient?: MerchantOrderPackingPort;
  readonly pollIntervalMs?: number;
}) {
  const [state, setState] = useState<QueueState>({
    orders: [],
    nextCursor: null,
    isLoading: true,
    isStale: false,
    failure: null,
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const operation = useRef(0);

  const load = useCallback(
    (cursor?: string, append = false) => {
      const operationId = ++operation.current;
      setState((current) => ({ ...current, isLoading: true, failure: null }));
      void orderClient.listOrders({ ...(cursor === undefined ? {} : { cursor }), limit: 20 }).then(
        (page) => {
          if (operation.current === operationId) {
            setState((current) => ({
              orders: append ? [...current.orders, ...page.orders] : page.orders,
              nextCursor: page.nextCursor,
              isLoading: false,
              isStale: false,
              failure: null,
            }));
          }
        },
        (error: unknown) => {
          if (operation.current === operationId) {
            setState((current) => ({
              ...current,
              isLoading: false,
              isStale: current.orders.length > 0,
              failure: asMerchantError(error),
            }));
          }
        },
      );
    },
    [orderClient],
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      load();
    });
    const timer =
      pollIntervalMs > 0
        ? setInterval(() => {
            load();
          }, pollIntervalMs)
        : null;
    return () => {
      operation.current += 1;
      if (timer !== null) clearInterval(timer);
    };
  }, [load, pollIntervalMs]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        orders: state.orders.filter((order) => groupMerchantOrderStatus(order.status) === group),
      })),
    [state.orders],
  );

  if (selectedOrderId !== null) {
    return (
      <MerchantOrderDetailScreen
        {...(decisionClient === undefined ? {} : { decisionClient })}
        {...(packingClient === undefined ? {} : { packingClient })}
        onBack={() => {
          setSelectedOrderId(null);
          load();
        }}
        orderClient={orderClient}
        orderId={selectedOrderId}
      />
    );
  }

  if (state.orders.length === 0 && state.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading merchant orders" size="large" />
      </View>
    );
  }
  if (state.orders.length === 0 && state.failure !== null) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.title}>
          Orders unavailable
        </Text>
        <Text style={styles.centerCopy}>{errorMessage(state.failure)}</Text>
        <Pressable
          accessibilityLabel="Retry merchant order queue"
          accessibilityRole="button"
          onPress={() => {
            load();
          }}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.eyebrow}>MERCHANT ORDERS</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Incoming queue
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh merchant order queue"
          accessibilityRole="button"
          disabled={state.isLoading}
          onPress={() => {
            load();
          }}
          style={styles.refreshAction}
        >
          <Text style={styles.refreshText}>{state.isLoading ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>

      {state.isStale && state.failure !== null ? (
        <View
          accessible
          accessibilityLabel={`Orders may be stale. ${errorMessage(state.failure)}`}
          style={styles.warning}
        >
          <Text style={styles.warningTitle}>Saved orders shown</Text>
          <Text style={styles.warningCopy}>{errorMessage(state.failure)}</Text>
        </View>
      ) : null}

      {state.orders.length === 0 ? (
        <View style={styles.empty}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            No shop orders yet
          </Text>
          <Text style={styles.meta}>
            New COD orders will appear after the backend commits them.
          </Text>
        </View>
      ) : (
        grouped.map(({ group, orders }) =>
          orders.length === 0 ? null : (
            <View key={group} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>
                {group} · {orders.length}
              </Text>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  onOpen={() => {
                    setSelectedOrderId(order.id);
                  }}
                  order={order}
                />
              ))}
            </View>
          ),
        )
      )}

      {state.nextCursor === null ? null : (
        <Pressable
          accessibilityLabel="Load more merchant orders"
          accessibilityRole="button"
          disabled={state.isLoading}
          onPress={() => {
            load(state.nextCursor ?? undefined, true);
          }}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryActionText}>Load more</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, backgroundColor: '#FFF8F2' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFF8F2',
  },
  centerCopy: {
    maxWidth: 360,
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  eyebrow: { color: '#8E3B46', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { marginTop: 6, color: '#241B16', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 5, color: '#665A52', fontSize: 15 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  group: { marginTop: 24 },
  groupTitle: {
    marginBottom: 8,
    color: '#665A52',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  card: {
    marginTop: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8DDD5',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  pressed: { opacity: 0.72 },
  orderNumber: { color: '#241B16', fontSize: 17, fontWeight: '800' },
  customer: { marginTop: 4, color: '#241B16', fontSize: 15, fontWeight: '700' },
  total: { color: '#241B16', fontSize: 15, fontWeight: '800' },
  meta: { marginTop: 4, color: '#665A52', fontSize: 13, lineHeight: 19 },
  status: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#F4E3D9',
    color: '#7B3440',
    fontSize: 11,
    fontWeight: '800',
  },
  warning: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#FFF1D6' },
  warningTitle: { color: '#6A4812', fontWeight: '800' },
  warningCopy: { marginTop: 4, color: '#6A4812', lineHeight: 20 },
  empty: { marginTop: 28, padding: 22, borderRadius: 18, backgroundColor: '#FFFFFF' },
  sectionTitle: { color: '#241B16', fontSize: 17, fontWeight: '800' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0E8E1',
  },
  itemCopy: { flex: 1 },
  note: { marginTop: 10, color: '#7B3440', fontSize: 14, lineHeight: 20 },
  link: { marginBottom: 16, color: '#8E3B46', fontSize: 16, fontWeight: '800' },
  refreshAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F4E3D9',
  },
  refreshText: { color: '#7B3440', fontWeight: '800' },
  primaryAction: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryAction: {
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryActionText: { color: '#8E3B46', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
