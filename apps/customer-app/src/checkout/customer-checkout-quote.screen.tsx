import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import { createCustomerOrderIdempotencyKey } from '../orders/customer-order-placement.client';
import {
  CustomerOrderError,
  type CustomerOrderPlacementPort,
  type PlacedCustomerCodOrder,
} from '../orders/customer-order.types';
import {
  isCustomerOrderSecurityFailure,
  isUncertainCustomerOrderFailure,
  matchesCustomerCheckoutTransaction,
} from './customer-cod-placement';
import type {
  CustomerCheckoutPlacementPhase,
  CustomerCheckoutQuoteIdentity,
} from './customer-checkout-transaction';
import { formatPaiseAsInr } from './format-inr';
import {
  CustomerCheckoutQuoteError,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuoteFailureKind,
  type CustomerCheckoutQuoteItem,
  type CustomerCheckoutQuotePort,
} from './customer-checkout-quote.types';

interface CustomerCheckoutQuoteScreenProps {
  readonly addressId: string | null;
  readonly quoteClient: CustomerCheckoutQuotePort;
  readonly orderClient?: CustomerOrderPlacementPort;
  readonly idempotencyKey?: string;
  readonly onQuoteAccepted?: (identity: CustomerCheckoutQuoteIdentity) => void;
  readonly onPlacementPhaseChange?: (phase: CustomerCheckoutPlacementPhase) => void;
  readonly onOrderConfirmed?: (orderId: string) => void;
  readonly onOrderPlaced?: (order: PlacedCustomerCodOrder) => void;
  readonly onSecurityFailure?: () => void;
  readonly createIdempotencyKey?: () => string;
  readonly now?: () => number;
}

interface ActiveCheckoutQuoteScreenProps extends Omit<CustomerCheckoutQuoteScreenProps, 'addressId'> {
  readonly addressId: string;
  readonly createIdempotencyKey: () => string;
  readonly now: () => number;
}

interface CheckoutQuoteState {
  readonly quote: CustomerCheckoutQuote | null;
  readonly isLoading: boolean;
  readonly failure: CustomerCheckoutQuoteError | null;
}

interface OrderPlacementState {
  readonly phase: CustomerCheckoutPlacementPhase;
  readonly failure: CustomerOrderError | null;
}

const INITIAL_LOADING_STATE: CheckoutQuoteState = Object.freeze({
  quote: null,
  isLoading: true,
  failure: null,
});

const INITIAL_PLACEMENT_STATE: OrderPlacementState = Object.freeze({
  phase: 'IDLE',
  failure: null,
});

function toCheckoutError(error: unknown): CustomerCheckoutQuoteError {
  return error instanceof CustomerCheckoutQuoteError
    ? error
    : new CustomerCheckoutQuoteError('UNKNOWN', null, false);
}

function toOrderError(error: unknown): CustomerOrderError {
  return error instanceof CustomerOrderError
    ? error
    : new CustomerOrderError('UNKNOWN', null, false);
}

function canKeepStaleQuote(kind: CustomerCheckoutQuoteFailureKind): boolean {
  return kind === 'TRANSPORT' || kind === 'TEMPORARILY_UNAVAILABLE';
}

function failureMessage(kind: CustomerCheckoutQuoteFailureKind): string {
  switch (kind) {
    case 'AUTHENTICATION':
      return 'Your session is no longer available. Sign in again before refreshing checkout.';
    case 'VALIDATION':
      return 'The selected delivery address or checkout request is invalid.';
    case 'EMPTY_CART':
      return 'Your cart is empty or no longer available.';
    case 'UNAVAILABLE_ITEM':
      return 'One or more cart items are no longer available. Review your cart and try again.';
    case 'CHANGED_PRICE':
      return 'A cart price changed. Refresh your cart before continuing.';
    case 'UNSERVICEABLE_ADDRESS':
      return 'This shop cannot deliver to the selected address.';
    case 'STALE_QUOTE':
      return 'This checkout quote is no longer current. Request a fresh quote.';
    case 'SHOP_UNAVAILABLE':
      return 'This shop is not accepting checkout right now.';
    case 'CONFLICT':
      return 'Your cart changed while checkout was loading. Refresh and review it again.';
    case 'TRANSPORT':
      return 'Reconnect to request current prices, availability, and totals.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Checkout totals are temporarily unavailable. Please try again.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not verify checkout totals. Please try again.';
  }
}

function placementFailureMessage(error: CustomerOrderError, uncertain: boolean): string {
  if (uncertain) {
    return 'The order request may have reached Vastra. Check the same order attempt before taking any other action.';
  }
  switch (error.kind) {
    case 'AUTHENTICATION':
      return 'Your session expired. Sign in again before placing another order.';
    case 'FORBIDDEN':
      return 'This order is unavailable for the current account.';
    case 'STALE_QUOTE':
      return 'Prices, availability, or this quote changed. Refresh checkout before trying again.';
    case 'VALIDATION':
      return 'The order request is no longer valid. Refresh checkout and review the address.';
    case 'CONFLICT':
      return 'The cart changed while the order was being placed. Refresh checkout.';
    case 'NOT_FOUND':
      return 'The cart, quote, or address is no longer available. Refresh checkout.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Order placement is temporarily unavailable. Retry this same order attempt.';
    case 'TRANSPORT':
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'Vastra could not safely confirm this order attempt.';
  }
}

function quoteExpiryLabel(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function variantLabel(item: CustomerCheckoutQuoteItem): string {
  return [item.colourName, item.sizeLabel, item.sku]
    .filter((value): value is string => value !== null)
    .join(' · ');
}

function QuoteNotice({
  label,
  message,
  assertive = false,
}: {
  readonly label: string;
  readonly message: string;
  readonly assertive?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${message}`}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      style={styles.notice}
    >
      <Text style={styles.noticeLabel}>{label}</Text>
      <Text style={styles.noticeMessage}>{message}</Text>
    </View>
  );
}

function MoneyRow({
  label,
  paise,
  emphasized = false,
}: {
  readonly label: string;
  readonly paise: number;
  readonly emphasized?: boolean;
}) {
  const formatted = formatPaiseAsInr(paise);
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${formatted}`}
      style={[styles.moneyRow, emphasized ? styles.totalRow : null]}
    >
      <Text style={[styles.moneyLabel, emphasized ? styles.totalText : null]}>{label}</Text>
      <Text style={[styles.moneyValue, emphasized ? styles.totalText : null]}>{formatted}</Text>
    </View>
  );
}

function QuoteContent({
  quote,
  expired,
  onRefresh,
  onBeginConfirmation,
  onCancelConfirmation,
  onPlaceOrder,
  placement,
  canPlaceOrder,
}: {
  readonly quote: CustomerCheckoutQuote;
  readonly expired: boolean;
  readonly onRefresh: () => void;
  readonly onBeginConfirmation: () => void;
  readonly onCancelConfirmation: () => void;
  readonly onPlaceOrder: () => void;
  readonly placement: OrderPlacementState;
  readonly canPlaceOrder: boolean;
}) {
  const hasPriceChanges = quote.items.some((item) => item.priceChanged);
  const hasStockShortfall = quote.items.some((item) => item.availableQuantity < item.quantity);
  const uncertain = placement.phase === 'UNCERTAIN';
  const refreshingRequired =
    expired ||
    placement.failure?.kind === 'STALE_QUOTE' ||
    placement.failure?.kind === 'VALIDATION' ||
    placement.failure?.kind === 'CONFLICT' ||
    placement.failure?.kind === 'NOT_FOUND';
  const total = formatPaiseAsInr(quote.totals.totalPaise);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View accessible accessibilityLiveRegion="polite" style={styles.liveRegion}>
        <Text>{`Checkout placement state ${placement.phase}`}</Text>
      </View>
      <Text style={styles.eyebrow}>CHECKOUT QUOTE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Review your COD total
      </Text>
      <Text style={styles.subtitle}>Live prices and availability from the shop.</Text>

      {expired ? (
        <QuoteNotice
          label="QUOTE EXPIRED"
          message="Refresh before continuing so every amount is current."
        />
      ) : null}
      {hasPriceChanges ? (
        <QuoteNotice
          label="PRICE UPDATED"
          message="One or more prices changed. The amounts below are the current shop prices."
        />
      ) : null}
      {hasStockShortfall ? (
        <QuoteNotice
          label="STOCK CHANGED"
          message="The shop cannot fulfil the quoted quantity. Refresh or return to your cart."
        />
      ) : null}

      <View
        accessible
        accessibilityLabel={`Deliver to ${quote.address.recipientName}, ${quote.address.line1}, ${quote.address.area}, ${quote.address.city}`}
        style={styles.card}
      >
        <Text style={styles.sectionLabel}>DELIVER TO</Text>
        <Text style={styles.shopName}>{quote.address.recipientName}</Text>
        <Text style={styles.metaText}>{quote.address.line1}</Text>
        {quote.address.line2 === null ? null : (
          <Text style={styles.metaText}>{quote.address.line2}</Text>
        )}
        <Text style={styles.metaText}>
          {quote.address.area}, {quote.address.city}, {quote.address.state} {quote.address.postalCode}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SHOP</Text>
        <Text style={styles.shopName}>{quote.shop.name}</Text>
        <Text style={styles.metaText}>
          {quote.items.length} {quote.items.length === 1 ? 'item' : 'items'} · Prep{' '}
          {quote.estimatedPreparationMinutes} min · Travel {quote.estimatedTravelMinutes} min
        </Text>
        <Text
          accessibilityLabel={`Estimated delivery ${quoteExpiryLabel(quote.estimatedDeliveryAt)}`}
          style={styles.deliveryEstimate}
        >
          Estimated delivery {quoteExpiryLabel(quote.estimatedDeliveryAt)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Items
        </Text>
        {quote.items.map((item) => (
          <View key={item.cartItemId} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.metaText}>{variantLabel(item)}</Text>
              <Text style={styles.quantity}>Quantity {item.quantity}</Text>
            </View>
            <Text
              accessibilityLabel={`${item.productName} total ${formatPaiseAsInr(item.lineTotalPaise)}`}
              style={styles.itemPrice}
            >
              {formatPaiseAsInr(item.lineTotalPaise)}
            </Text>
          </View>
        ))}
      </View>

      <View accessible accessibilityLiveRegion="polite" style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Price details
        </Text>
        <MoneyRow label="Subtotal" paise={quote.totals.subtotalPaise} />
        <MoneyRow label="Product discount" paise={quote.totals.productDiscountPaise} />
        <MoneyRow label="Coupon discount" paise={quote.totals.couponDiscountPaise} />
        <MoneyRow label="Delivery fee" paise={quote.totals.deliveryFeePaise} />
        <MoneyRow label="Platform fee" paise={quote.totals.platformFeePaise} />
        <MoneyRow label="Tax" paise={quote.totals.taxPaise} />
        <MoneyRow emphasized label="Final COD total" paise={quote.totals.totalPaise} />
      </View>

      <Text
        accessibilityLabel={`Quote valid until ${quoteExpiryLabel(quote.expiresAt)}`}
        style={styles.expiry}
      >
        Quote valid until {quoteExpiryLabel(quote.expiresAt)}
      </Text>

      {placement.failure === null ? null : (
        <QuoteNotice
          assertive
          label={
            uncertain
              ? 'ORDER STATUS UNKNOWN'
              : placement.failure.kind === 'STALE_QUOTE'
                ? 'QUOTE MUST BE REFRESHED'
                : 'ORDER NOT PLACED'
          }
          message={placementFailureMessage(placement.failure, uncertain)}
        />
      )}

      {placement.phase === 'CONFIRMING' ? (
        <View accessible accessibilityLiveRegion="polite" style={styles.confirmationCard}>
          <Text style={styles.confirmationLabel}>CONFIRM CASH ON DELIVERY</Text>
          <Text style={styles.confirmationTitle}>Pay {total} when your order arrives</Text>
          <Text style={styles.confirmationCopy}>
            Vastra will place the order using the latest server quote. Repeated taps cannot create a
            second order.
          </Text>
          <Pressable
            accessibilityLabel={`Confirm COD order for ${total}`}
            accessibilityRole="button"
            onPress={onPlaceOrder}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Confirm COD order · {total}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Return to checkout review"
            accessibilityRole="button"
            onPress={onCancelConfirmation}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Review checkout</Text>
          </Pressable>
        </View>
      ) : placement.phase === 'SUBMITTING' ? (
        <Pressable
          accessibilityLabel="Order placement in progress. Checkout refresh unavailable"
          accessibilityRole="button"
          accessibilityState={{ disabled: true, busy: true }}
          disabled
          style={[styles.primaryAction, styles.disabledAction]}
        >
          <Text style={styles.primaryActionText}>Placing order…</Text>
        </Pressable>
      ) : placement.phase === 'RECONCILING' ? (
        <Pressable
          accessibilityLabel="Order reconciliation in progress"
          accessibilityRole="button"
          accessibilityState={{ disabled: true, busy: true }}
          disabled
          style={[styles.primaryAction, styles.disabledAction]}
        >
          <Text style={styles.primaryActionText}>Checking order status…</Text>
        </Pressable>
      ) : placement.phase === 'UNCERTAIN' ? (
        <Pressable
          accessibilityLabel="Reconcile uncertain COD order attempt"
          accessibilityRole="button"
          onPress={onPlaceOrder}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Check order status safely</Text>
        </Pressable>
      ) : refreshingRequired ? (
        <Pressable
          accessibilityLabel="Refresh checkout quote"
          accessibilityRole="button"
          onPress={onRefresh}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Refresh quote</Text>
        </Pressable>
      ) : placement.phase === 'FAILED' ? (
        <Pressable
          accessibilityLabel="Retry same COD order attempt"
          accessibilityRole="button"
          onPress={onPlaceOrder}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Retry same order attempt</Text>
        </Pressable>
      ) : placement.phase === 'SUCCEEDED' ? (
        <Pressable
          accessibilityLabel="Order confirmed"
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.primaryAction, styles.disabledAction]}
        >
          <Text style={styles.primaryActionText}>Order confirmed</Text>
        </Pressable>
      ) : canPlaceOrder && !expired && !hasStockShortfall ? (
        <Pressable
          accessibilityLabel={`Review COD order for ${total}`}
          accessibilityRole="button"
          onPress={onBeginConfirmation}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Continue to COD confirmation · {total}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Continue to COD order placement in the next step"
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.primaryAction, styles.disabledAction]}
        >
          <Text style={styles.primaryActionText}>COD placement unavailable</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ActiveCustomerCheckoutQuoteScreen({
  addressId,
  quoteClient,
  orderClient,
  idempotencyKey,
  onQuoteAccepted,
  onPlacementPhaseChange,
  onOrderConfirmed,
  onOrderPlaced,
  onSecurityFailure,
  createIdempotencyKey,
  now,
}: ActiveCheckoutQuoteScreenProps) {
  const [state, setState] = useState<CheckoutQuoteState>(INITIAL_LOADING_STATE);
  const [placement, setPlacement] = useState<OrderPlacementState>(INITIAL_PLACEMENT_STATE);
  const [clock, setClock] = useState(now);
  const operation = useRef(0);
  const placementOperation = useRef(0);
  const mounted = useRef(true);
  const quoteInFlight = useRef(false);
  const placementInFlight = useRef(false);
  const placementKey = useRef<string | null>(idempotencyKey ?? null);

  useEffect(() => {
    onPlacementPhaseChange?.(placement.phase);
  }, [onPlacementPhaseChange, placement.phase]);

  const runRequest = useCallback(
    (operationId: number) => {
      void quoteClient.createQuote({ addressId }).then(
        (quote) => {
          quoteInFlight.current = false;
          if (!mounted.current || operation.current !== operationId) return;
          if (quote.address.id !== addressId) {
            setState({
              quote: null,
              isLoading: false,
              failure: new CustomerCheckoutQuoteError('MALFORMED_RESPONSE', null, false),
            });
            onSecurityFailure?.();
            return;
          }
          setClock(now());
          setState({ quote, isLoading: false, failure: null });
          onQuoteAccepted?.({
            addressId: quote.address.id,
            cartId: quote.cartId,
            quoteId: quote.id,
          });
        },
        (error: unknown) => {
          quoteInFlight.current = false;
          if (!mounted.current || operation.current !== operationId) return;
          const failure = toCheckoutError(error);
          setState((current) => ({
            quote: canKeepStaleQuote(failure.kind) ? current.quote : null,
            isLoading: false,
            failure,
          }));
          if (failure.kind === 'AUTHENTICATION') onSecurityFailure?.();
        },
      );
    },
    [addressId, now, onQuoteAccepted, onSecurityFailure, quoteClient],
  );

  const requestQuote = useCallback(() => {
    if (placementInFlight.current || quoteInFlight.current) return;
    quoteInFlight.current = true;
    setPlacement(INITIAL_PLACEMENT_STATE);
    const operationId = ++operation.current;
    setState((current) => ({ ...current, isLoading: true, failure: null }));
    runRequest(operationId);
  }, [runRequest]);

  const beginConfirmation = useCallback(() => {
    if (
      orderClient === undefined ||
      state.quote === null ||
      placementInFlight.current ||
      Date.parse(state.quote.expiresAt) <= now()
    ) {
      setClock(now());
      return;
    }
    setPlacement({ phase: 'CONFIRMING', failure: null });
  }, [now, orderClient, state.quote]);

  const placeOrder = useCallback(() => {
    if (orderClient === undefined || state.quote === null || placementInFlight.current) return;
    const reconciling = placement.phase === 'UNCERTAIN';
    if (!reconciling && Date.parse(state.quote.expiresAt) <= now()) {
      setClock(now());
      return;
    }

    placementInFlight.current = true;
    const placementOperationId = ++placementOperation.current;
    const activeKey = placementKey.current ?? idempotencyKey ?? createIdempotencyKey();
    placementKey.current = activeKey;
    setPlacement({ phase: reconciling ? 'RECONCILING' : 'SUBMITTING', failure: null });

    const identity: CustomerCheckoutQuoteIdentity = {
      addressId: state.quote.address.id,
      cartId: state.quote.cartId,
      quoteId: state.quote.id,
    };

    void orderClient
      .placeCodOrder({
        cartId: identity.cartId,
        quoteId: identity.quoteId,
        addressId: identity.addressId,
        idempotencyKey: activeKey,
      })
      .then(
        (order) => {
          if (!mounted.current || placementOperation.current !== placementOperationId) return;
          placementInFlight.current = false;
          if (!matchesCustomerCheckoutTransaction(order, identity)) {
            setPlacement({
              phase: 'FAILED',
              failure: new CustomerOrderError('MALFORMED_RESPONSE', null, false),
            });
            onSecurityFailure?.();
            return;
          }
          setPlacement({ phase: 'SUCCEEDED', failure: null });
          onOrderConfirmed?.(order.id);
          onOrderPlaced?.(order);
        },
        (error: unknown) => {
          if (!mounted.current || placementOperation.current !== placementOperationId) return;
          placementInFlight.current = false;
          const failure = toOrderError(error);
          setPlacement({
            phase: isUncertainCustomerOrderFailure(failure) ? 'UNCERTAIN' : 'FAILED',
            failure,
          });
          if (isCustomerOrderSecurityFailure(failure)) onSecurityFailure?.();
        },
      );
  }, [
    createIdempotencyKey,
    idempotencyKey,
    now,
    onOrderConfirmed,
    onOrderPlaced,
    onSecurityFailure,
    orderClient,
    placement.phase,
    state.quote,
  ]);

  useEffect(() => {
    mounted.current = true;
    quoteInFlight.current = true;
    const operationId = ++operation.current;
    runRequest(operationId);
    return () => {
      mounted.current = false;
      quoteInFlight.current = false;
      placementInFlight.current = false;
      operation.current += 1;
      placementOperation.current += 1;
    };
  }, [runRequest]);

  useEffect(() => {
    if (state.quote === null) return;
    const expiresIn = Date.parse(state.quote.expiresAt) - now();
    if (expiresIn <= 0) return;
    const timer = setTimeout(() => {
      setClock(now());
    }, Math.min(expiresIn + 1, 2_147_483_647));
    return () => {
      clearTimeout(timer);
    };
  }, [now, state.quote]);

  const expired = state.quote !== null && Date.parse(state.quote.expiresAt) <= clock;
  const networkState = useMemo(
    () =>
      resolveCustomerNetworkState({
        isLoading: state.isLoading,
        isOffline: state.failure?.kind === 'TRANSPORT',
        errorMessage:
          state.failure === null || state.failure.kind === 'EMPTY_CART'
            ? null
            : failureMessage(state.failure.kind),
        hasData: state.quote !== null,
        hasStaleData: state.quote !== null && state.failure !== null,
        loadingLabel: 'Loading current checkout quote',
        emptyTitle: 'Your cart is empty',
        emptyMessage: 'Add an item from one shop before opening checkout.',
        emptyActionLabel: null,
      }),
    [state],
  );

  return (
    <CustomerNetworkStateBoundary onRetry={requestQuote} state={networkState}>
      {state.quote === null ? null : (
        <QuoteContent
          canPlaceOrder={orderClient !== undefined}
          expired={expired}
          onBeginConfirmation={beginConfirmation}
          onCancelConfirmation={() => {
            setPlacement(INITIAL_PLACEMENT_STATE);
          }}
          onPlaceOrder={placeOrder}
          onRefresh={requestQuote}
          placement={placement}
          quote={state.quote}
        />
      )}
    </CustomerNetworkStateBoundary>
  );
}

export function CustomerCheckoutQuoteScreen({
  addressId,
  quoteClient,
  orderClient,
  idempotencyKey,
  onQuoteAccepted,
  onPlacementPhaseChange,
  onOrderConfirmed,
  onOrderPlaced,
  onSecurityFailure,
  createIdempotencyKey = createCustomerOrderIdempotencyKey,
  now = Date.now,
}: CustomerCheckoutQuoteScreenProps) {
  if (addressId === null) {
    return (
      <CustomerNetworkStateBoundary
        onRetry={() => undefined}
        state={{
          kind: 'EMPTY',
          title: 'Select a delivery address',
          message: 'Choose a saved address to request current prices and delivery totals.',
          actionLabel: null,
        }}
      >
        {null}
      </CustomerNetworkStateBoundary>
    );
  }

  return (
    <ActiveCustomerCheckoutQuoteScreen
      key={addressId}
      addressId={addressId}
      createIdempotencyKey={createIdempotencyKey}
      now={now}
      quoteClient={quoteClient}
      {...(orderClient === undefined ? {} : { orderClient })}
      {...(idempotencyKey === undefined ? {} : { idempotencyKey })}
      {...(onQuoteAccepted === undefined ? {} : { onQuoteAccepted })}
      {...(onPlacementPhaseChange === undefined ? {} : { onPlacementPhaseChange })}
      {...(onOrderConfirmed === undefined ? {} : { onOrderConfirmed })}
      {...(onOrderPlaced === undefined ? {} : { onOrderPlaced })}
      {...(onSecurityFailure === undefined ? {} : { onSecurityFailure })}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: '#F7F8FA',
  },
  liveRegion: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  eyebrow: { color: '#6C3AA8', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#1F2937', fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 8, color: '#667085', fontSize: 15, lineHeight: 22 },
  notice: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7B553',
    borderRadius: 12,
    backgroundColor: '#FFF3D8',
  },
  noticeLabel: { color: '#7A4B00', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  noticeMessage: { marginTop: 5, color: '#5F430D', fontSize: 14, lineHeight: 20 },
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
  shopName: { marginTop: 6, color: '#1F2937', fontSize: 17, fontWeight: '700' },
  metaText: { marginTop: 4, color: '#667085', fontSize: 14, lineHeight: 20 },
  deliveryEstimate: { marginTop: 10, color: '#18794E', fontSize: 14, fontWeight: '700' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  itemCopy: { flex: 1, paddingRight: 12 },
  itemName: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  quantity: { marginTop: 4, color: '#475467', fontSize: 13 },
  itemPrice: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  totalRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E4E7EC' },
  moneyLabel: { color: '#667085', fontSize: 14 },
  moneyValue: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  totalText: { color: '#1F2937', fontSize: 17, fontWeight: '800' },
  expiry: { marginTop: 16, color: '#667085', fontSize: 13, textAlign: 'center' },
  confirmationCard: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BDA4D8',
    borderRadius: 16,
    backgroundColor: '#F8F5FB',
  },
  confirmationLabel: { color: '#542887', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  confirmationTitle: { marginTop: 8, color: '#1F2937', fontSize: 19, fontWeight: '800' },
  confirmationCopy: { marginTop: 8, color: '#475467', fontSize: 14, lineHeight: 21 },
  primaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#6C3AA8',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryActionText: { color: '#6C3AA8', fontSize: 15, fontWeight: '700' },
  disabledAction: { opacity: 0.5 },
});
