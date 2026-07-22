import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatPaiseAsInr } from '../checkout/format-inr';
import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import {
  CustomerCartError,
  type CustomerCart,
  type CustomerCartItem,
  type CustomerCartPort,
} from './customer-cart.types';

interface CartState {
  readonly cart: CustomerCart | null;
  readonly loaded: boolean;
  readonly isLoading: boolean;
  readonly mutationKey: string | null;
  readonly failure: CustomerCartError | null;
  readonly announcement: string;
  readonly confirmClear: boolean;
}

function toCartError(error: unknown): CustomerCartError {
  return error instanceof CustomerCartError ? error : new CustomerCartError('UNKNOWN', null, false);
}

function failureMessage(error: CustomerCartError): string {
  switch (error.kind) {
    case 'AUTHENTICATION':
      return 'Your session expired. Sign in again before changing the cart.';
    case 'FORBIDDEN':
      return 'This account cannot use the customer cart.';
    case 'TRANSPORT':
    case 'TIMEOUT':
      return 'Reconnect to refresh current price and stock.';
    case 'SHOP_CONFLICT':
      return 'This cart belongs to another shop. Confirm replacement from the product screen.';
    case 'PRICE_CONFLICT':
      return 'A price changed. The cart was refreshed with the current amount.';
    case 'INVENTORY_CONFLICT':
    case 'UNAVAILABLE_ITEM':
      return 'Availability changed. Review the refreshed cart before checkout.';
    case 'NOT_FOUND':
      return 'That cart item is no longer available.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'The cart service is temporarily unavailable.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not load the authoritative cart. Please try again.';
  }
}

function variantLabel(item: CustomerCartItem): string {
  return [item.colourName, item.sizeLabel, item.sku]
    .filter((value): value is string => value !== null)
    .join(' · ');
}

export function CustomerCartScreen({
  cartClient,
  onCheckout,
  onSessionExpired,
}: {
  readonly cartClient: CustomerCartPort;
  readonly onCheckout: () => void;
  readonly onSessionExpired?: () => void;
}) {
  const operation = useRef(0);
  const mutationInFlight = useRef(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Readonly<Record<string, string>>>({});
  const [state, setState] = useState<CartState>({
    cart: null,
    loaded: false,
    isLoading: true,
    mutationKey: null,
    failure: null,
    announcement: 'Loading cart',
    confirmClear: false,
  });

  const applyCart = useCallback((cart: CustomerCart | null, announcement: string) => {
    setQuantityDrafts(
      Object.fromEntries((cart?.items ?? []).map((item) => [item.id, String(item.quantity)])),
    );
    setState({
      cart,
      loaded: true,
      isLoading: false,
      mutationKey: null,
      failure: null,
      announcement,
      confirmClear: false,
    });
  }, []);

  const runLoad = useCallback(
    (operationId: number) => {
      void cartClient.getCart().then(
        (cart) => {
          if (operation.current === operationId) applyCart(cart, 'Cart refreshed');
        },
        (error: unknown) => {
          if (operation.current !== operationId) return;
          const failure = toCartError(error);
          setState((current) => ({
            ...current,
            loaded: true,
            isLoading: false,
            mutationKey: null,
            failure,
            announcement: failureMessage(failure),
          }));
          if (failure.kind === 'AUTHENTICATION') onSessionExpired?.();
        },
      );
    },
    [applyCart, cartClient, onSessionExpired],
  );

  const refresh = useCallback(() => {
    if (mutationInFlight.current) return;
    const operationId = ++operation.current;
    setState((current) => ({
      ...current,
      isLoading: current.cart === null,
      failure: null,
      announcement: 'Refreshing cart',
    }));
    runLoad(operationId);
  }, [runLoad]);

  useEffect(() => {
    const operationId = ++operation.current;
    runLoad(operationId);
    return () => {
      operation.current += 1;
    };
  }, [runLoad]);

  const mutate = useCallback(
    (key: string, request: () => Promise<CustomerCart | null>, success: string) => {
      if (mutationInFlight.current) return;
      mutationInFlight.current = true;
      const operationId = ++operation.current;
      setState((current) => ({
        ...current,
        mutationKey: key,
        failure: null,
        announcement: `${key} in progress`,
      }));
      void request().then(
        (cart) => {
          mutationInFlight.current = false;
          if (operation.current === operationId) applyCart(cart, success);
        },
        (error: unknown) => {
          mutationInFlight.current = false;
          if (operation.current !== operationId) return;
          const failure = toCartError(error);
          setState((current) => ({
            ...current,
            mutationKey: null,
            failure,
            announcement: failureMessage(failure),
          }));
          if (failure.kind === 'AUTHENTICATION') {
            onSessionExpired?.();
            return;
          }
          if (
            failure.kind === 'PRICE_CONFLICT' ||
            failure.kind === 'INVENTORY_CONFLICT' ||
            failure.kind === 'UNAVAILABLE_ITEM' ||
            failure.kind === 'NOT_FOUND'
          ) {
            const refreshId = ++operation.current;
            runLoad(refreshId);
          }
        },
      );
    },
    [applyCart, onSessionExpired, runLoad],
  );

  const updateQuantity = useCallback(
    (item: CustomerCartItem, quantity: number) => {
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) return;
      if (quantity === 0) {
        mutate(
          `remove-${item.id}`,
          () => cartClient.removeItem(item.id),
          `${item.productName} removed from cart`,
        );
      } else {
        mutate(
          `quantity-${item.id}`,
          () => cartClient.updateItem(item.id, quantity),
          `${item.productName} quantity updated to ${String(quantity)}`,
        );
      }
    },
    [cartClient, mutate],
  );

  const cart = state.cart;
  const hasData = cart !== null && cart.items.length > 0;
  const networkState = useMemo(
    () =>
      resolveCustomerNetworkState({
        isLoading: state.isLoading,
        isOffline: state.failure?.kind === 'TRANSPORT' || state.failure?.kind === 'TIMEOUT',
        errorMessage: state.failure === null ? null : failureMessage(state.failure),
        hasData,
        hasStaleData: hasData && state.failure !== null,
        loadingLabel: 'Loading current cart price and availability',
        emptyTitle: 'Your cart is empty',
        emptyMessage: 'Add an available item from one shop to begin checkout.',
        emptyActionLabel: null,
      }),
    [hasData, state.failure, state.isLoading],
  );
  const checkoutBlocked =
    cart === null ||
    cart.hasPriceChanges ||
    cart.hasUnavailableItems ||
    !cart.shop.acceptsOnlineOrders ||
    state.mutationKey !== null;

  return (
    <CustomerNetworkStateBoundary onRetry={refresh} state={networkState}>
      {cart === null ? null : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={state.isLoading} />}
        >
          <View accessible accessibilityLiveRegion="polite" style={styles.liveRegion}>
            <Text>{state.announcement}</Text>
          </View>
          <View style={styles.headerRow}>
            <View>
              <Text accessibilityRole="header" style={styles.title}>
                Cart
              </Text>
              <Text style={styles.shopName}>{cart.shop.name}</Text>
            </View>
            <Pressable
              accessibilityLabel="Clear all cart items"
              accessibilityRole="button"
              accessibilityState={{ disabled: state.mutationKey !== null }}
              disabled={state.mutationKey !== null}
              onPress={() => {
                setState((current) => ({ ...current, confirmClear: true }));
              }}
              style={styles.clearAction}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>

          {state.confirmClear ? (
            <View accessible accessibilityLiveRegion="polite" style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Clear this cart?</Text>
              <Text style={styles.meta}>All items from {cart.shop.name} will be removed.</Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityLabel="Keep cart items"
                  accessibilityRole="button"
                  onPress={() => {
                    setState((current) => ({ ...current, confirmClear: false }));
                  }}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryText}>Keep items</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Confirm clear cart"
                  accessibilityRole="button"
                  onPress={() => {
                    mutate('clear-cart', () => cartClient.clearCart(), 'Cart cleared');
                  }}
                  style={styles.dangerAction}
                >
                  <Text style={styles.dangerText}>Clear cart</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {cart.hasPriceChanges ? (
            <View accessible accessibilityLiveRegion="assertive" style={styles.warningCard}>
              <Text style={styles.warningTitle}>PRICE UPDATED</Text>
              <Text style={styles.meta}>Review current prices before continuing.</Text>
            </View>
          ) : null}
          {cart.hasUnavailableItems ? (
            <View accessible accessibilityLiveRegion="assertive" style={styles.warningCard}>
              <Text style={styles.warningTitle}>AVAILABILITY CHANGED</Text>
              <Text style={styles.meta}>Remove or reduce unavailable items before checkout.</Text>
            </View>
          ) : null}

          {cart.items.map((item) => {
            const busy = state.mutationKey?.endsWith(item.id) === true;
            const draft = quantityDrafts[item.id] ?? String(item.quantity);
            return (
              <View
                accessible
                accessibilityLabel={`${item.productName}, quantity ${String(item.quantity)}, current line total ${formatPaiseAsInr(item.currentLineTotalPaise)}`}
                key={item.id}
                style={[styles.itemCard, !item.isAvailable && styles.unavailableCard]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.meta}>{variantLabel(item)}</Text>
                    <Text style={styles.meta}>
                      {item.isAvailable
                        ? `${String(item.availableQuantity)} currently available`
                        : 'Currently unavailable'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.itemTotal}>
                      {formatPaiseAsInr(item.currentLineTotalPaise)}
                    </Text>
                    {item.priceChanged ? (
                      <Text accessibilityLabel="Previous line price" style={styles.previousPrice}>
                        {formatPaiseAsInr(item.lineTotalPaise)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.quantityRow}>
                  <Pressable
                    accessibilityLabel={`Decrease ${item.productName} quantity`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy || state.mutationKey !== null }}
                    disabled={busy || state.mutationKey !== null}
                    onPress={() => {
                      updateQuantity(item, item.quantity - 1);
                    }}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantityButtonText}>−</Text>
                  </Pressable>
                  <TextInput
                    accessibilityLabel={`Direct quantity for ${item.productName}`}
                    editable={state.mutationKey === null}
                    inputMode="numeric"
                    onChangeText={(value) => {
                      setQuantityDrafts((current) => ({ ...current, [item.id]: value }));
                    }}
                    onSubmitEditing={() => {
                      updateQuantity(item, Number(draft));
                    }}
                    selectTextOnFocus
                    style={styles.quantityInput}
                    value={draft}
                  />
                  <Pressable
                    accessibilityLabel={`Increase ${item.productName} quantity`}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled:
                        busy ||
                        state.mutationKey !== null ||
                        !item.isAvailable ||
                        item.quantity >= item.availableQuantity,
                    }}
                    disabled={
                      busy ||
                      state.mutationKey !== null ||
                      !item.isAvailable ||
                      item.quantity >= item.availableQuantity
                    }
                    onPress={() => {
                      updateQuantity(item, item.quantity + 1);
                    }}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove ${item.productName} from cart`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: state.mutationKey !== null }}
                    disabled={state.mutationKey !== null}
                    onPress={() => {
                      updateQuantity(item, 0);
                    }}
                    style={styles.removeAction}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View accessible accessibilityLiveRegion="polite" style={styles.summaryCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Current subtotal</Text>
              <Text
                accessibilityLabel={`Current cart subtotal ${formatPaiseAsInr(cart.currentSubtotalPaise)}`}
                style={styles.totalValue}
              >
                {formatPaiseAsInr(cart.currentSubtotalPaise)}
              </Text>
            </View>
            <Text style={styles.meta}>Final fees and total are calculated in checkout.</Text>
            <Pressable
              accessibilityLabel={
                checkoutBlocked
                  ? 'Checkout unavailable until cart changes are resolved'
                  : `Continue to checkout with ${String(cart.itemCount)} items`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: checkoutBlocked }}
              disabled={checkoutBlocked}
              onPress={onCheckout}
              style={[styles.checkoutAction, checkoutBlocked && styles.disabledAction]}
            >
              <Text style={styles.checkoutText}>Continue to checkout</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </CustomerNetworkStateBoundary>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 44 },
  liveRegion: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '700' },
  shopName: { marginTop: 4, color: '#667085', fontSize: 15 },
  clearAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  clearText: { color: '#B42318', fontSize: 14, fontWeight: '700' },
  confirmCard: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#FFF4ED' },
  confirmTitle: { color: '#7A271A', fontSize: 16, fontWeight: '700' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  secondaryAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: '#475467', fontWeight: '700' },
  dangerAction: {
    minHeight: 44,
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#B42318',
  },
  dangerText: { color: '#FFFFFF', fontWeight: '700' },
  warningCard: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: '#FFF3D8' },
  warningTitle: { color: '#7A4B00', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  itemCard: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  unavailableCard: { borderColor: '#FDA29B', backgroundColor: '#FFFBFA' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  itemCopy: { flex: 1, paddingRight: 12 },
  itemName: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, color: '#667085', fontSize: 14, lineHeight: 20 },
  itemTotal: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  previousPrice: {
    marginTop: 4,
    color: '#98A2B3',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
  },
  quantityButtonText: { color: '#1F2937', fontSize: 20, fontWeight: '700' },
  quantityInput: {
    width: 52,
    height: 44,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    color: '#1F2937',
    textAlign: 'center',
  },
  removeAction: { minHeight: 44, justifyContent: 'center', marginLeft: 'auto', paddingLeft: 16 },
  removeText: { color: '#B42318', fontSize: 14, fontWeight: '700' },
  summaryCard: { marginTop: 20, padding: 18, borderRadius: 16, backgroundColor: '#F8F5FB' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#1F2937', fontSize: 17, fontWeight: '700' },
  totalValue: { color: '#1F2937', fontSize: 17, fontWeight: '700' },
  checkoutAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#6C3AA8',
  },
  disabledAction: { opacity: 0.45 },
  checkoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
