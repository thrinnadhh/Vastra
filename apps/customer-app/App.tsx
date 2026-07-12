import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

export function CustomerFoundationScreen() {
  return (
    <View style={styles.screen}>
      <View accessible accessibilityLabel="Vastra brand mark" style={styles.brandMark}>
        <Text style={styles.brandLetter}>V</Text>
      </View>

      <Text style={styles.eyebrow}>CUSTOMER MOBILE</Text>

      <Text accessibilityRole="header" style={styles.title}>
        Vastra
      </Text>

      <Text style={styles.description}>A calm foundation for discovering fashion.</Text>

      <View
        accessible
        accessibilityLabel="Customer mobile foundation is ready"
        style={styles.statusCard}
      >
        <View style={styles.statusDot} />

        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>Foundation ready</Text>

          <Text style={styles.statusDescription}>The customer experience will be built here.</Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <CustomerFoundationScreen />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brandMark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderRadius: 18,
    backgroundColor: '#8E3B46',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  eyebrow: {
    marginBottom: 8,
    color: '#8E3B46',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: '#241B16',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  description: {
    maxWidth: 320,
    marginTop: 12,
    color: '#665A52',
    fontSize: 18,
    lineHeight: 27,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 48,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8DDD5',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  statusDot: {
    width: 10,
    height: 10,
    marginRight: 14,
    borderRadius: 5,
    backgroundColor: '#287A55',
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    color: '#241B16',
    fontSize: 16,
    fontWeight: '700',
  },
  statusDescription: {
    marginTop: 3,
    color: '#665A52',
    fontSize: 14,
    lineHeight: 20,
  },
});
