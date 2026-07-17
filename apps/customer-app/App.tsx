import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { CustomerSessionApp } from './src/auth/default-customer-session';
import { DefaultCustomerCheckoutQuote } from './src/checkout/default-customer-checkout-quote';
import { DefaultCustomerOrders } from './src/orders/default-customer-orders';

export function CustomerAppContent({ addressId = null }: { readonly addressId?: string | null }) {
  const [route, setRoute] = useState<'CHECKOUT' | 'ORDERS'>('CHECKOUT');

  return (
    <View style={styles.content}>
      <View accessibilityRole="tablist" style={styles.navigation}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: route === 'CHECKOUT' }}
          onPress={() => {
            setRoute('CHECKOUT');
          }}
          style={[styles.navigationAction, route === 'CHECKOUT' ? styles.selectedAction : null]}
        >
          <Text style={route === 'CHECKOUT' ? styles.selectedText : styles.navigationText}>
            Checkout
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: route === 'ORDERS' }}
          onPress={() => {
            setRoute('ORDERS');
          }}
          style={[styles.navigationAction, route === 'ORDERS' ? styles.selectedAction : null]}
        >
          <Text style={route === 'ORDERS' ? styles.selectedText : styles.navigationText}>
            My orders
          </Text>
        </Pressable>
      </View>
      <View style={styles.route}>
        {route === 'CHECKOUT' ? (
          <DefaultCustomerCheckoutQuote addressId={addressId} />
        ) : (
          <DefaultCustomerOrders />
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <CustomerSessionApp>
          <CustomerAppContent />
        </CustomerSessionApp>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  route: { flex: 1 },
  navigation: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  navigationAction: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10 },
  selectedAction: { backgroundColor: '#6C3AA8' },
  navigationText: { color: '#475467', fontSize: 14, fontWeight: '700' },
  selectedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
});
