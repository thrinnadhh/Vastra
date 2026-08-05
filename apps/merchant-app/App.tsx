import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { MerchantSessionApp } from './src/auth/default-merchant-session';
import { DefaultMerchantInventory } from './src/inventory/merchant-inventory.screen';
import { DefaultMerchantOrders } from './src/orders/default-merchant-orders';

type MerchantTab = 'ORDERS' | 'INVENTORY';

export function MerchantAppContent(): React.JSX.Element {
  const [tab, setTab] = useState<MerchantTab>('ORDERS');
  return (
    <View style={styles.content}>
      <View style={styles.workspace}>
        {tab === 'ORDERS' ? <DefaultMerchantOrders /> : <DefaultMerchantInventory />}
      </View>
      <View accessibilityRole="tablist" style={styles.navigation}>
        <Pressable
          accessibilityLabel="Open merchant orders"
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'ORDERS' }}
          onPress={() => {
            setTab('ORDERS');
          }}
          style={[styles.tab, tab === 'ORDERS' ? styles.tabSelected : null]}
        >
          <Text style={[styles.tabText, tab === 'ORDERS' ? styles.tabTextSelected : null]}>
            Orders
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Open merchant inventory scanner"
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'INVENTORY' }}
          onPress={() => {
            setTab('INVENTORY');
          }}
          style={[styles.tab, tab === 'INVENTORY' ? styles.tabSelected : null]}
        >
          <Text style={[styles.tabText, tab === 'INVENTORY' ? styles.tabTextSelected : null]}>
            Inventory
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MerchantApplicationRoot(): React.JSX.Element {
  return (
    <MobileApplicationShell
      accessibilityLabel="Vastra merchant application"
      role="merchant"
      safeAreaStyle={styles.safeArea}
      testID="merchant-application-shell"
    >
      <MerchantSessionApp>
        <MerchantAppContent />
      </MerchantSessionApp>
    </MobileApplicationShell>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <MerchantApplicationRoot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  content: { flex: 1 },
  workspace: { flex: 1 },
  navigation: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4D7CE',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F4ECE6',
  },
  tabSelected: { backgroundColor: '#8E3B46' },
  tabText: { color: '#665A52', fontWeight: '900' },
  tabTextSelected: { color: '#FFFFFF' },
});
