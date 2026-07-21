import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';
import { CustomerLocationScreen } from '../location/customer-location.screen';
import type { CustomerCoordinates } from '../location/customer-location.types';
import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';
import { ApiCustomerSearchAdapter } from './api-customer-search.adapter';
import { CustomerSearchScreen } from './customer-search.screen';
import type { CustomerSearchSessionState } from './customer-search.types';

export function DefaultCustomerSearchRoot({
  location,
  onLocationReady,
  sessionState,
  setSessionState,
}: {
  readonly location: CustomerCoordinates | null;
  readonly onLocationReady: (coordinates: CustomerCoordinates) => void;
  readonly sessionState: CustomerSearchSessionState;
  readonly setSessionState: Dispatch<SetStateAction<CustomerSearchSessionState>>;
}) {
  const apiClient = useCustomerApiClient();
  const searchPort = useMemo(() => new ApiCustomerSearchAdapter(apiClient), [apiClient]);
  const locationPort = useMemo(() => new ExpoCustomerLocationAdapter(), []);
  const serviceabilityPort = useMemo(
    () => new ApiCustomerServiceabilityAdapter(apiClient),
    [apiClient],
  );
  const [locationMode, setLocationMode] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (selectedProductId !== null) {
    return (
      <View style={styles.placeholder}>
        <Text accessibilityRole="header" style={styles.title}>
          Product details continue in FE-S04-04
        </Text>
        <Text style={styles.copy}>
          Search preserved product {selectedProductId}. The typed detail route will replace this
          truthful boundary in its owning ticket.
        </Text>
        <Pressable
          accessibilityLabel="Back to search results"
          accessibilityRole="button"
          onPress={() => {
            setSelectedProductId(null);
          }}
          style={styles.action}
        >
          <Text style={styles.actionText}>Back to results</Text>
        </Pressable>
      </View>
    );
  }

  if (locationMode) {
    return (
      <View style={styles.flow}>
        <Pressable
          accessibilityLabel="Back to search"
          accessibilityRole="button"
          onPress={() => {
            setLocationMode(false);
          }}
          style={styles.backAction}
        >
          <Text style={styles.backText}>Back to search</Text>
        </Pressable>
        <CustomerLocationScreen
          locationPort={locationPort}
          onLocationReady={(coordinates) => {
            onLocationReady(coordinates);
            setLocationMode(false);
          }}
          serviceabilityPort={serviceabilityPort}
        />
      </View>
    );
  }

  return (
    <CustomerSearchScreen
      location={location}
      onRequestLocation={() => {
        setLocationMode(true);
      }}
      onSelectProduct={setSelectedProductId}
      searchPort={searchPort}
      sessionState={sessionState}
      setSessionState={setSessionState}
    />
  );
}

const styles = StyleSheet.create({
  flow: { flex: 1, backgroundColor: '#FFFDFB' },
  backAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20 },
  backText: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
  placeholder: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFFDFB' },
  title: { color: '#241B16', fontSize: 24, fontWeight: '800' },
  copy: { marginTop: 10, color: '#75675F', fontSize: 15, lineHeight: 22 },
  action: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#8E3B46',
  },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
