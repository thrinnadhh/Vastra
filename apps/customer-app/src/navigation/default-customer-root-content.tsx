import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { useCustomerSessionActions } from '../auth/customer-session-actions';
import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';
import { CustomerLocationScreen } from '../location/customer-location.screen';
import type { CustomerCoordinates } from '../location/customer-location.types';
import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';
import { ApiCustomerPreferencesAdapter } from '../profile/api-customer-preferences.adapter';
import { CustomerProfilePreferencesScreen } from '../profile/customer-profile-preferences.screen';

export function DefaultCustomerHomeRoot({ openCheckout }: { readonly openCheckout: () => void }) {
  const apiClient = useCustomerApiClient();
  const locationPort = useMemo(() => new ExpoCustomerLocationAdapter(), []);
  const serviceabilityPort = useMemo(
    () => new ApiCustomerServiceabilityAdapter(apiClient),
    [apiClient],
  );
  const [locationMode, setLocationMode] = useState(false);
  const [location, setLocation] = useState<CustomerCoordinates | null>(null);

  if (locationMode) {
    return (
      <View style={styles.flow}>
        <Pressable
          accessibilityLabel="Back to Home"
          accessibilityRole="button"
          onPress={() => {
            setLocationMode(false);
          }}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryText}>Back to Home</Text>
        </Pressable>
        <CustomerLocationScreen
          locationPort={locationPort}
          onLocationReady={(coordinates) => {
            setLocation(coordinates);
            setLocationMode(false);
          }}
          serviceabilityPort={serviceabilityPort}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Home
      </Text>
      <Text style={styles.description}>
        Set a serviceable shopping area, then continue to the preserved checkout flow.
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {location === null ? 'Shopping location not checked' : 'Shopping location is serviceable'}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setLocationMode(true);
        }}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryText}>
          {location === null ? 'Set shopping location' : 'Change shopping location'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={openCheckout} style={styles.primaryAction}>
        <Text style={styles.primaryText}>Continue to checkout</Text>
      </Pressable>
    </View>
  );
}

export function DefaultCustomerProfileRoot() {
  const apiClient = useCustomerApiClient();
  const session = useCustomerSessionActions();
  const preferencesPort = useMemo(() => new ApiCustomerPreferencesAdapter(apiClient), [apiClient]);
  const [editingPreferences, setEditingPreferences] = useState(false);

  if (editingPreferences) {
    return (
      <CustomerProfilePreferencesScreen
        identity={{ fullName: session.account.fullName }}
        onContinue={() => {
          setEditingPreferences(false);
        }}
        preferencesPort={preferencesPort}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Profile
      </Text>
      <Text style={styles.description}>{session.account.fullName ?? 'Customer profile'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setEditingPreferences(true);
        }}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryText}>Edit shopping preferences</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void session.signOut();
        }}
        style={styles.signOutAction}
      >
        <Text style={styles.signOutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { flex: 1, backgroundColor: '#FFF8F2' },
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8F2' },
  title: { color: '#241B16', fontSize: 28, fontWeight: '700' },
  description: { marginTop: 10, color: '#665A52', fontSize: 16, lineHeight: 24 },
  status: { marginTop: 16, color: '#3B3029', fontSize: 14, fontWeight: '600' },
  primaryAction: {
    minHeight: 48,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryAction: {
    minHeight: 48,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: { color: '#6B2D38', fontSize: 15, fontWeight: '700' },
  signOutAction: {
    minHeight: 48,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A12032',
    borderRadius: 14,
  },
  signOutText: { color: '#A12032', fontSize: 15, fontWeight: '700' },
});
