import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { CustomerSessionApp } from './src/auth/default-customer-session';
import { DefaultCustomerCheckoutQuote } from './src/checkout/default-customer-checkout-quote';
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
import type { CustomerRoute } from './src/navigation/customer-routes';
import { DefaultCustomerOrders } from './src/orders/default-customer-orders';

const PRODUCTION_LINKING_PORT = new ReactNativeCustomerLinkingPort();

function DeepLinkedUnavailable({ onBack }: { readonly onBack: () => void }) {
  return (
    <View style={styles.linkedUnavailable}>
      <Text accessibilityRole="header" style={styles.linkedUnavailableTitle}>
        Destination unavailable in this build
      </Text>
      <Text style={styles.linkedUnavailableDescription}>
        This link is recognized securely, but its feature screen belongs to a later approved frontend ticket.
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
  const slots: CustomerRootNavigationSlots = {
    home: (openCheckout) => <DefaultCustomerHomeRoot openCheckout={openCheckout} />,
    discover: (
      <CustomerRootPlaceholder
        description="Discovery routes are ready for the Sprint 04 catalogue implementation."
        title="Discover"
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
    checkout: <DefaultCustomerCheckoutQuote addressId={addressId} />,
    renderDeepLinkedRoute,
  };

  return <CustomerRootNavigation linkingPort={linkingPort} slots={slots} />;
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
