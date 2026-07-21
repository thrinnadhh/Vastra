import { MobileApplicationShell } from '@vastra/app-shells/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { CaptainSessionApp } from './src/auth/default-captain-session';
import { CaptainOperationsScreen } from './src/captain-operations.screen';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <MobileApplicationShell
        accessibilityLabel="Vastra captain application"
        role="captain"
        safeAreaStyle={styles.safeArea}
        testID="captain-application-shell"
      >
        <CaptainSessionApp>
          <CaptainOperationsScreen />
        </CaptainSessionApp>
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
