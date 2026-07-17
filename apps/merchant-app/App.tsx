import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { MerchantSessionApp } from './src/auth/default-merchant-session';
import { DefaultMerchantOrders } from './src/orders/default-merchant-orders';

export function MerchantAppContent() {
  return <DefaultMerchantOrders />;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <MerchantSessionApp>
          <MerchantAppContent />
        </MerchantSessionApp>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
});
