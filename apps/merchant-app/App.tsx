import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { MerchantSessionApp } from './src/auth/default-merchant-session';
import { DefaultMerchantOrders } from './src/orders/default-merchant-orders';

export function MerchantAppContent(): React.JSX.Element {
  return <DefaultMerchantOrders />;
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
});
