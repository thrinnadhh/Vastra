import { StatusBar } from 'expo-status-bar';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { CaptainSessionApp } from './src/auth/default-captain-session';
import { CaptainOperationsScreen } from './src/captain-operations.screen';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF8F2' }}>
        <StatusBar style="dark" />
        <CaptainSessionApp>
          <CaptainOperationsScreen />
        </CaptainSessionApp>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
