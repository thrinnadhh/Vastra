import { useCallback, useEffect, useRef, useState } from 'react';

import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { DefaultCustomerAddresses } from './src/addresses/default-customer-addresses';
import { CustomerSessionApp } from './src/auth/default-customer-session';
import { DefaultCustomerCart } from './src/cart/default-customer-cart';
import {
  acceptCustomerCheckoutQuote,
  confirmCustomerCheckoutOrder,
  createCustomerCheckoutTransaction,
  invalidateCustomerCheckoutQuote,
  selectCustomerCheckoutAddress,
  setCustomerCheckoutPlacementPhase,
  type CustomerCheckoutPlacementPhase,
  type CustomerCheckoutQuoteIdentity,
  type CustomerCheckoutTransaction,
} from './src/checkout/customer-checkout-transaction';
import { DefaultCustomerCheckoutQuote } from './src/checkout/default-customer-checkout-quote';
import type { CustomerDiscoveryIntent } from './src/discovery/customer-discovery-intent';
import { DefaultCustomerSearchRoot } from './src/discovery/default-customer-search';
import { createInitialCustomerSearchSessionState } from './src/discovery/customer-search.types';
import type { CustomerCoordinates } from './src/location/customer-location.types';
import {
  ReactNativeCustomerLinkingPort,
  type CustomerLinkingPort,
} from './src/navigation/customer-linking.port';
import {
  DefaultCustomerHomeRoot,
  DefaultCustomerProfileRoot,
} from './src/navigation/default-customer-root-content';
import {
  CustomerRootNavigation,
  CustomerRootPlaceholder,
  type CustomerRootNavigationSlots,
  type CustomerTransactionNavigationActions,
} from './src/navigation/customer-root-navigation';
import type { CustomerRoute, UUID } from './src/navigation/customer-routes';
import { DefaultCustomerOrderConfirmation } from './src/orders/default-customer-order-confirmation';
import { createCustomerOrderIdempotencyKey } from './src/orders/customer-order-placement.client';
import { DefaultCustomerOrders } from './src/orders/default-customer-orders';

const PRODUCTION_LINKING_PORT = new ReactNativeCustomerLinkingPort();

function DeepLinkedUnavailable({ onBack }: { readonly onBack: () => void }) {
  return (
    <View style={styles.linkedUnavailable}>
      <Text accessibilityRole="header" style={styles.linkedUnavailableTitle}>
        Destination unavailable in this build
      </Text>
      <Text style={styles.linkedUnavailableDescription}>
        This link is recognized securely, but its feature screen belongs to a later approved
        frontend ticket.
      </Text>
      <Pressable
        accessibilityLabel="Back from linked destination"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.linkedUnavailableAction}
      >
        <Text style={styles.linkedUnavailableActionText}>Back</Text>
      </Pressable>
    </View>
  );
}

function CheckoutRouteRejected({ onReject }: { readonly onReject: () => void }) {
  useEffect(() => {
    onReject();
  }, [onReject]);

  return (
    <CustomerRootPlaceholder
      description="This checkout route could not be verified for the active account."
      title="Checkout unavailable"
    />
  );
}

function renderDeepLinkedRoute(route: CustomerRoute, onBack: () => void) {
  if (route.scope === 'ORDERS' && route.name === 'OrderDetail') {
    return (
      <DefaultCustomerOrders
        initialOrderId={route.params.orderId}
        key={route.params.orderId}
        onBackFromInitialOrder={onBack}
      />
    );
  }

  if (
    (route.scope === 'DISCOVERY' &&
      (route.name === 'ProductDetail' || route.name === 'ShopDetail')) ||
    (route.scope === 'STYLE' && route.name === 'LookDetail')
  ) {
    return <DeepLinkedUnavailable onBack={onBack} />;
  }

  return null;
}

export function CustomerAppContent({
  addressId = null,
  linkingPort,
}: {
  readonly addressId?: string | null;
  readonly linkingPort?: CustomerLinkingPort;
}) {
  const [shoppingLocation, setShoppingLocation] = useState<CustomerCoordinates | null>(null);
  const [searchSessionState, setSearchSessionState] = useState(
    createInitialCustomerSearchSessionState,
  );
  const [discoveryIntent, setDiscoveryIntent] = useState<CustomerDiscoveryIntent | null>(null);
  const [checkoutTransaction, setCheckoutTransaction] =
    useState<CustomerCheckoutTransaction | null>(null);
  const transactionActionsRef = useRef<CustomerTransactionNavigationActions | null>(null);

  const purgeCheckout = useCallback((): void => {
    setCheckoutTransaction(null);
    transactionActionsRef.current?.resetToTab('Home');
  }, []);

  const acceptQuote = useCallback((identity: CustomerCheckoutQuoteIdentity): void => {
    setCheckoutTransaction((current) =>
      current === null ? null : acceptCustomerCheckoutQuote(current, identity),
    );
  }, []);

  const updatePlacementPhase = useCallback((phase: CustomerCheckoutPlacementPhase): void => {
    setCheckoutTransaction((current) =>
      current === null ? null : setCustomerCheckoutPlacementPhase(current, phase),
    );
  }, []);

  const openConfirmedOrder = useCallback((orderId: string): void => {
    setCheckoutTransaction((current) =>
      current === null ? null : confirmCustomerCheckoutOrder(current, orderId),
    );
    transactionActionsRef.current?.replaceRoute({
      scope: 'TRANSACTION',
      name: 'OrderConfirmation',
      params: { orderId: orderId as UUID },
    });
  }, []);

  const slots: CustomerRootNavigationSlots = {
    home: ({ openCheckout, openDiscover }) => (
      <DefaultCustomerHomeRoot
        location={shoppingLocation}
        onLocationReady={setShoppingLocation}
        openCheckout={openCheckout}
        openDiscover={openDiscover}
        openDiscoverIntent={(intent) => {
          setDiscoveryIntent(intent);
          openDiscover();
        }}
      />
    ),
    discover: (
      <DefaultCustomerSearchRoot
        initialIntent={discoveryIntent}
        location={shoppingLocation}
        onIntentConsumed={() => {
          setDiscoveryIntent(null);
        }}
        onLocationReady={setShoppingLocation}
        sessionState={searchSessionState}
        setSessionState={setSearchSessionState}
      />
    ),
    style: (
      <CustomerRootPlaceholder
        description="Wardrobe and private Group Style routes remain available for their approved sprints."
        title="Style"
      />
    ),
    orders: <DefaultCustomerOrders />,
    profile: <DefaultCustomerProfileRoot />,
    renderTransactionRoute: (route, actions) => {
      transactionActionsRef.current = actions;

      switch (route.name) {
        case 'Cart':
          return (
            <DefaultCustomerCart
              onCheckout={() => {
                const started = createCustomerCheckoutTransaction(
                  createCustomerOrderIdempotencyKey(),
                );
                setCheckoutTransaction(
                  addressId === null ? started : selectCustomerCheckoutAddress(started, addressId),
                );
                actions.openRoute({
                  scope: 'TRANSACTION',
                  name: 'AddressList',
                  params: { mode: 'SELECT_FOR_CHECKOUT', returnTo: 'Checkout' },
                });
              }}
              onSessionExpired={purgeCheckout}
            />
          );
        case 'AddressList': {
          const selectedAddressId = checkoutTransaction?.addressId ?? null;
          const openCheckoutForAddress = (nextAddressId: string): void => {
            actions.openRoute({
              scope: 'TRANSACTION',
              name: 'Checkout',
              params: { addressId: nextAddressId as UUID },
            });
          };
          return (
            <View style={styles.transactionFlow}>
              <DefaultCustomerAddresses
                mode="CHECKOUT"
                onInvalidateQuote={() => {
                  setCheckoutTransaction((current) =>
                    current === null ? null : invalidateCustomerCheckoutQuote(current),
                  );
                }}
                onSelectedAddressChange={(nextAddressId) => {
                  setCheckoutTransaction((current) =>
                    current === null
                      ? null
                      : selectCustomerCheckoutAddress(current, nextAddressId),
                  );
                  if (nextAddressId !== null) openCheckoutForAddress(nextAddressId);
                }}
                selectedAddressId={selectedAddressId}
              />
              {selectedAddressId === null ? null : (
                <Pressable
                  accessibilityLabel="Continue with selected delivery address"
                  accessibilityRole="button"
                  onPress={() => {
                    openCheckoutForAddress(selectedAddressId);
                  }}
                  style={styles.checkoutContinueAction}
                >
                  <Text style={styles.checkoutContinueText}>Continue with selected address</Text>
                </Pressable>
              )}
            </View>
          );
        }
        case 'Checkout':
          return (
            <DefaultCustomerCheckoutQuote
              addressId={checkoutTransaction?.addressId ?? route.params?.addressId ?? null}
              {...(checkoutTransaction === null
                ? {}
                : { idempotencyKey: checkoutTransaction.idempotencyKey })}
              onOrderConfirmed={openConfirmedOrder}
              onPlacementPhaseChange={updatePlacementPhase}
              onQuoteAccepted={acceptQuote}
              onSecurityFailure={purgeCheckout}
            />
          );
        case 'OrderConfirmation':
          if (
            checkoutTransaction === null ||
            checkoutTransaction.placementPhase !== 'SUCCEEDED' ||
            checkoutTransaction.orderId !== route.params.orderId
          ) {
            return <CheckoutRouteRejected onReject={purgeCheckout} />;
          }
          return (
            <DefaultCustomerOrderConfirmation
              expectedAddressId={checkoutTransaction.addressId}
              expectedCartId={checkoutTransaction.cartId}
              expectedQuoteId={checkoutTransaction.quoteId}
              onContinueShopping={() => {
                actions.resetToTab('Discover');
              }}
              onSecurityFailure={purgeCheckout}
              onViewOrder={(confirmedOrderId) => {
                actions.openOrderDetail(confirmedOrderId);
              }}
              onViewOrders={() => {
                actions.resetToTab('Orders');
              }}
              orderId={route.params.orderId}
            />
          );
        case 'AddressForm':
          return (
            <CustomerRootPlaceholder
              description="Address forms are presented inside the authoritative address flow."
              title="Address form"
            />
          );
        case 'Payment':
          return (
            <CustomerRootPlaceholder
              description="Cash on Delivery does not open a separate payment route."
              title="Payment route unavailable"
            />
          );
      }
    },
    renderDeepLinkedRoute,
    onTransactionExit: () => {
      setCheckoutTransaction(null);
      transactionActionsRef.current = null;
    },
  };

  return (
    <CustomerRootNavigation slots={slots} {...(linkingPort === undefined ? {} : { linkingPort })} />
  );
}

export function CustomerApplicationRoot(): React.JSX.Element {
  return (
    <MobileApplicationShell
      accessibilityLabel="Vastra customer application"
      role="customer"
      safeAreaStyle={styles.safeArea}
      testID="customer-application-shell"
    >
      <CustomerSessionApp>
        <CustomerAppContent linkingPort={PRODUCTION_LINKING_PORT} />
      </CustomerSessionApp>
    </MobileApplicationShell>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <CustomerApplicationRoot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  transactionFlow: { flex: 1, backgroundColor: '#F7F8FA' },
  checkoutContinueAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#6C3AA8',
  },
  checkoutContinueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkedUnavailable: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF8F2',
  },
  linkedUnavailableTitle: { color: '#1D2939', fontSize: 26, fontWeight: '700' },
  linkedUnavailableDescription: {
    marginTop: 10,
    color: '#667085',
    fontSize: 16,
    lineHeight: 24,
  },
  linkedUnavailableAction: {
    minHeight: 48,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#8E3B46',
  },
  linkedUnavailableActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
