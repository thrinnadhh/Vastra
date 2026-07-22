import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { useCustomerSessionActions } from '../auth/customer-session-actions';
import { ApiCustomerHomeAdapter } from '../discovery/api-customer-home.adapter';
import { CustomerHomeScreen } from '../discovery/customer-home.screen';
import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';
import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';
import { CustomerLocationScreen } from '../location/customer-location.screen';
import type { CustomerCoordinates } from '../location/customer-location.types';
import { ApiCustomerPreferencesAdapter } from '../profile/api-customer-preferences.adapter';
import { ApiCustomerProfileSetupAdapter } from '../profile/api-customer-profile-setup.adapter';
import { CustomerProfilePreferencesScreen } from '../profile/customer-profile-preferences.screen';
import { CustomerProfileSetupScreen } from '../profile/customer-profile-setup.screen';

export function DefaultCustomerHomeRoot({
  openCheckout,
  openDiscover,
}: {
  readonly openCheckout: () => void;
  readonly openDiscover: () => void;
}) {
  const apiClient = useCustomerApiClient();
  const locationPort = useMemo(() => new ExpoCustomerLocationAdapter(), []);
  const serviceabilityPort = useMemo(
    () => new ApiCustomerServiceabilityAdapter(apiClient),
    [apiClient],
  );
  const homePort = useMemo(() => new ApiCustomerHomeAdapter(apiClient), [apiClient]);
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

  if (location !== null) {
    return (
      <CustomerHomeScreen
        coordinates={location}
        homePort={homePort}
        onChangeLocation={() => {
          setLocationMode(true);
        }}
        onOpenCheckout={openCheckout}
        onSearch={openDiscover}
        onSelectCategory={openDiscover}
        onSelectProduct={openDiscover}
        onSelectShop={openDiscover}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>LOCAL FASHION STARTS HERE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Discover fashion from shops around you.
      </Text>
      <Text style={styles.description}>
        Set a shopping location so Vastra can confirm serviceability and load real nearby catalogue
        data.
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        Shopping location not checked
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setLocationMode(true);
        }}
        style={styles.primaryAction}
      >
        <Text style={styles.primaryText}>Set shopping location</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={openCheckout} style={styles.secondaryAction}>
        <Text style={styles.secondaryText}>Continue to checkout</Text>
      </Pressable>
    </View>
  );
}

export function DefaultCustomerProfileRoot() {
  const apiClient = useCustomerApiClient();
  const session = useCustomerSessionActions();
  const preferencesPort = useMemo(() => new ApiCustomerPreferencesAdapter(apiClient), [apiClient]);
  const profilePort = useMemo(() => new ApiCustomerProfileSetupAdapter(apiClient), [apiClient]);
  const [displayName, setDisplayName] = useState(session.account.fullName);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState(false);

  if (editingProfile) {
    return (
      <CustomerProfileSetupScreen
        initialFullName={displayName ?? ''}
        onCompleted={(fullName) => {
          setDisplayName(fullName);
          setEditingProfile(false);
        }}
        profilePort={profilePort}
      />
    );
  }

  if (editingPreferences) {
    return (
      <CustomerProfilePreferencesScreen
        identity={{ fullName: displayName }}
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
      <Text style={styles.description}>{displayName ?? 'Customer profile'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setEditingProfile(true);
        }}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryText}>Edit profile</Text>
      </Pressable>
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
  eyebrow: { color: '#8E3B46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 8, color: '#241B16', fontSize: 28, fontWeight: '700' },
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