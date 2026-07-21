import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';
import { CustomerLocationScreen } from '../location/customer-location.screen';
import type { CustomerCoordinates } from '../location/customer-location.types';
import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';
import { ApiCustomerSearchAdapter } from './api-customer-search.adapter';
import { ApiCustomerShopAdapter } from './api-customer-shop.adapter';
import { CustomerSearchScreen } from './customer-search.screen';
import type { CustomerSearchSessionState } from './customer-search.types';
import { CustomerShopsScreen } from './customer-shops.screen';

type CustomerDiscoverMode = 'SEARCH' | 'SHOPS';

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
  const shopPort = useMemo(() => new ApiCustomerShopAdapter(apiClient), [apiClient]);
  const locationPort = useMemo(() => new ExpoCustomerLocationAdapter(), []);
  const serviceabilityPort = useMemo(
    () => new ApiCustomerServiceabilityAdapter(apiClient),
    [apiClient],
  );
  const [locationMode, setLocationMode] = useState(false);
  const [discoverMode, setDiscoverMode] = useState<CustomerDiscoverMode>('SEARCH');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (selectedProductId !== null) {
    return (
      <View style={styles.placeholder}>
        <Text accessibilityRole="header" style={styles.title}>
          Product details continue in FE-S04-04
        </Text>
        <Text style={styles.copy}>
          Discover preserved product {selectedProductId}. The typed detail route will replace this
          truthful boundary in its owning ticket.
        </Text>
        <Pressable
          accessibilityLabel="Back to discovery results"
          accessibilityRole="button"
          onPress={() => {
            setSelectedProductId(null);
          }}
          style={styles.action}
        >
          <Text style={styles.actionText}>Back to discovery</Text>
        </Pressable>
      </View>
    );
  }

  if (locationMode) {
    return (
      <View style={styles.flow}>
        <Pressable
          accessibilityLabel="Back to Discover"
          accessibilityRole="button"
          onPress={() => {
            setLocationMode(false);
          }}
          style={styles.backAction}
        >
          <Text style={styles.backText}>Back to Discover</Text>
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

  const requestLocation = (): void => {
    setLocationMode(true);
  };

  return (
    <View style={styles.root}>
      <View
        accessibilityLabel="Discover content mode"
        accessibilityRole="tablist"
        style={styles.modeTabs}
      >
        <Pressable
          accessibilityLabel="Products search mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: discoverMode === 'SEARCH' }}
          onPress={() => {
            setDiscoverMode('SEARCH');
          }}
          style={[styles.modeTab, discoverMode === 'SEARCH' ? styles.modeTabSelected : null]}
        >
          <Text style={discoverMode === 'SEARCH' ? styles.modeTextSelected : styles.modeText}>
            Products
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Nearby shops mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: discoverMode === 'SHOPS' }}
          onPress={() => {
            setDiscoverMode('SHOPS');
          }}
          style={[styles.modeTab, discoverMode === 'SHOPS' ? styles.modeTabSelected : null]}
        >
          <Text style={discoverMode === 'SHOPS' ? styles.modeTextSelected : styles.modeText}>
            Shops
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {discoverMode === 'SEARCH' ? (
          <CustomerSearchScreen
            location={location}
            onRequestLocation={requestLocation}
            onSelectProduct={setSelectedProductId}
            searchPort={searchPort}
            sessionState={sessionState}
            setSessionState={setSessionState}
          />
        ) : (
          <CustomerShopsScreen
            location={location}
            onRequestLocation={requestLocation}
            onSelectProduct={setSelectedProductId}
            shopPort={shopPort}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDFB' },
  content: { flex: 1 },
  modeTabs: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DDD7',
    backgroundColor: '#FFFFFF',
  },
  modeTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  modeTabSelected: { backgroundColor: '#F7E9EC' },
  modeText: { color: '#75675F', fontSize: 14, fontWeight: '700' },
  modeTextSelected: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
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
