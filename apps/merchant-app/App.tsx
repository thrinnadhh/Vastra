import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { MerchantSessionApp } from './src/auth/default-merchant-session';
import { DefaultMerchantOrders } from './src/orders/default-merchant-orders';

export function MerchantAppContent() {
  return <DefaultMerchantOrders />;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
});
