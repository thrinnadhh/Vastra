import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
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
  readonly now?: () => number;
}

interface ActiveCheckoutQuoteScreenProps {
  readonly addressId: string;
  readonly quoteClient: CustomerCheckoutQuotePort;
  readonly now: () => number;
}

interface CheckoutQuoteState {
  readonly quote: CustomerCheckoutQuote | null;
  readonly isLoading: boolean;
  readonly failure: CustomerCheckoutQuoteError | null;
}

const INITIAL_LOADING_STATE: CheckoutQuoteState = Object.freeze({
  quote: null,
  isLoading: true,
  failure: null,
});

function toCheckoutError(error: unknown): CustomerCheckoutQuoteError {
  if (error instanceof CustomerCheckoutQuoteError) {
    return error;
  }
  return new CustomerCheckoutQuoteError('UNKNOWN', null, false);
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

function quoteExpiryLabel(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function variantLabel(item: CustomerCheckoutQuoteItem): string {
  const values = [item.colourName, item.sizeLabel, item.sku].filter(
    (value): value is string => value !== null,
  );
  return values.join(' · ');
}

function QuoteNotice({ label, message }: { readonly label: string; readonly message: string }) {
  return (
    <View accessible accessibilityLabel={`${label}. ${message}`} style={styles.notice}>
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
}: {
  readonly quote: CustomerCheckoutQuote;
  readonly expired: boolean;
  readonly onRefresh: () => void;
}) {
  const hasPriceChanges = quote.items.some((item) => item.priceChanged);

  return (
    <ScrollView contentContainerStyle={styles.content}>
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

      <View style={styles.card}>
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

      {expired ? (
        <Pressable
          accessibilityLabel="Refresh checkout quote"
          accessibilityRole="button"
          onPress={onRefresh}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Refresh quote</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Continue to COD order placement in the next step"
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.primaryAction, styles.disabledAction]}
        >
          <Text style={styles.primaryActionText}>COD placement coming next</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ActiveCustomerCheckoutQuoteScreen({
  addressId,
  quoteClient,
  now,
}: ActiveCheckoutQuoteScreenProps) {
  const [state, setState] = useState<CheckoutQuoteState>(INITIAL_LOADING_STATE);
  const [clock, setClock] = useState(now);
  const operation = useRef(0);

  const runRequest = useCallback(
    (operationId: number) => {
      void quoteClient.createQuote({ addressId }).then(
        (quote) => {
          if (operation.current === operationId) {
            setClock(now());
            setState({ quote, isLoading: false, failure: null });
          }
        },
        (error: unknown) => {
          if (operation.current === operationId) {
            const failure = toCheckoutError(error);
            setState((current) => ({
              quote: canKeepStaleQuote(failure.kind) ? current.quote : null,
              isLoading: false,
              failure,
            }));
          }
        },
      );
    },
    [addressId, now, quoteClient],
  );

  const requestQuote = useCallback(() => {
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

  useEffect(() => {
    if (state.quote === null) {
      return;
    }
    const expiresIn = Date.parse(state.quote.expiresAt) - now();
    if (expiresIn <= 0) {
      return;
    }
    const timer = setTimeout(
      () => {
        setClock(now());
      },
      Math.min(expiresIn + 1, 2_147_483_647),
    );
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
        <QuoteContent expired={expired} onRefresh={requestQuote} quote={state.quote} />
      )}
    </CustomerNetworkStateBoundary>
  );
}

export function CustomerCheckoutQuoteScreen({
  addressId,
  quoteClient,
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
      now={now}
      quoteClient={quoteClient}
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
  eyebrow: {
    color: '#6C3AA8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 8,
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#667085',
    fontSize: 15,
    lineHeight: 22,
  },
  notice: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7B553',
    borderRadius: 12,
    backgroundColor: '#FFF3D8',
  },
  noticeLabel: {
    color: '#7A4B00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  noticeMessage: {
    marginTop: 5,
    color: '#5F430D',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionTitle: {
    marginBottom: 8,
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '600',
  },
  shopName: {
    marginTop: 6,
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '600',
  },
  metaText: {
    marginTop: 4,
    color: '#667085',
    fontSize: 13,
    lineHeight: 18,
  },
  deliveryEstimate: {
    marginTop: 10,
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  itemCopy: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
  quantity: {
    marginTop: 7,
    color: '#1F2937',
    fontSize: 13,
  },
  itemPrice: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  moneyRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moneyLabel: {
    color: '#667085',
    fontSize: 14,
  },
  moneyValue: {
    color: '#1F2937',
    fontSize: 14,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },
  totalText: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '700',
  },
  expiry: {
    marginTop: 16,
    color: '#667085',
    fontSize: 13,
    textAlign: 'center',
  },
  primaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#6C3AA8',
  },
  disabledAction: {
    opacity: 0.55,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
