import { useState } from 'react';

import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { DefaultCustomerAddresses } from './src/addresses/default-customer-addresses';
import { CustomerSessionApp } from './src/auth/default-customer-session';
import { DefaultCustomerCart } from './src/cart/default-customer-cart';
import {
  createCustomerCheckoutTransaction,
  invalidateCustomerCheckoutQuote,
  selectCustomerCheckoutAddress,
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
} from './src/navigation/customer-root-navigation';
import type { CustomerRoute, UUID } from './src/navigation/customer-routes';
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
              onSessionExpired={() => {
                setCheckoutTransaction(null);
                actions.resetToTab('Home');
              }}
            />
          );
        case 'AddressList':
          return (
            <DefaultCustomerAddresses
              mode="CHECKOUT"
              onInvalidateQuote={() => {
                setCheckoutTransaction((current) =>
                  current === null ? null : invalidateCustomerCheckoutQuote(current),
                );
              }}
              onSelectedAddressChange={(selectedAddressId) => {
                setCheckoutTransaction((current) =>
                  current === null
                    ? null
                    : selectCustomerCheckoutAddress(current, selectedAddressId),
                );
                if (selectedAddressId !== null) {
                  actions.openRoute({
                    scope: 'TRANSACTION',
                    name: 'Checkout',
                    params: { addressId: selectedAddressId as UUID },
                  });
                }
              }}
              selectedAddressId={checkoutTransaction?.addressId ?? null}
            />
          );
        case 'Checkout':
          return (
            <DefaultCustomerCheckoutQuote
              addressId={checkoutTransaction?.addressId ?? route.params?.addressId ?? null}
            />
          );
        case 'OrderConfirmation':
          return (
            <CustomerRootPlaceholder
              description="The order confirmation route requires a server-confirmed order."
              title="Order confirmation unavailable"
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
