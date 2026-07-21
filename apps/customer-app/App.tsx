import { useState } from 'react';

import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { CustomerSessionApp } from './src/auth/default-customer-session';
import { DefaultCustomerCheckoutQuote } from './src/checkout/default-customer-checkout-quote';
import { DefaultCustomerSearchRoot } from './src/discovery/default-customer-search';
import { createInitialCustomerSearchSessionState } from './src/discovery/customer-search.types';
import type { CustomerCoordinates } from './src/location/customer-location.types';
import {
  DefaultCustomerHomeRoot,
  DefaultCustomerProfileRoot,
} from './src/navigation/default-customer-root-content';
import {
  CustomerRootNavigation,
  CustomerRootPlaceholder,
  type CustomerRootNavigationSlots,
} from './src/navigation/customer-root-navigation';
import { DefaultCustomerOrders } from './src/orders/default-customer-orders';

export function CustomerAppContent({ addressId = null }: { readonly addressId?: string | null }) {
  const [shoppingLocation, setShoppingLocation] = useState<CustomerCoordinates | null>(null);
  const [searchSessionState, setSearchSessionState] = useState(
    createInitialCustomerSearchSessionState,
  );
  const slots: CustomerRootNavigationSlots = {
    home: ({ openCheckout, openDiscover }) => (
      <DefaultCustomerHomeRoot
        location={shoppingLocation}
        onLocationReady={setShoppingLocation}
        openCheckout={openCheckout}
        openDiscover={openDiscover}
      />
    ),
    discover: (
      <DefaultCustomerSearchRoot
        location={shoppingLocation}
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
    checkout: <DefaultCustomerCheckoutQuote addressId={addressId} />,
  };

  return <CustomerRootNavigation slots={slots} />;
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
        <CustomerAppContent />
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
});
