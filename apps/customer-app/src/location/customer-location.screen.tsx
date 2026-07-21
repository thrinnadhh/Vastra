import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  customerLocationFailureMessage,
  parseManualCoordinates,
  type CustomerCoordinates,
  type CustomerLocationFailureKind,
  type CustomerLocationPort,
  type CustomerServiceabilityPort,
} from './customer-location.types';

export function CustomerLocationScreen({
  locationPort,
  serviceabilityPort,
  onLocationReady,
}: {
  readonly locationPort: CustomerLocationPort;
  readonly serviceabilityPort: CustomerServiceabilityPort;
  readonly onLocationReady: (coordinates: CustomerCoordinates) => void;
}) {
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failureKind, setFailureKind] = useState<CustomerLocationFailureKind | null>(null);

  const verifyCoordinates = async (coordinates: CustomerCoordinates): Promise<void> => {
    setBusy(true);
    setFailureKind(null);

    try {
      const result = await serviceabilityPort.checkLocation(coordinates);
      if (result.kind === 'SERVICEABLE') {
        onLocationReady(coordinates);
        return;
      }

      setFailureKind(result.kind);
      setManualVisible(true);
    } catch {
      setFailureKind('UNAVAILABLE');
      setManualVisible(true);
    } finally {
      setBusy(false);
    }
  };

  const useCurrentLocation = async (): Promise<void> => {
    setBusy(true);
    setFailureKind(null);

    try {
      if (!(await locationPort.hasServicesEnabled())) {
        setFailureKind('GPS_DISABLED');
        setManualVisible(true);
        return;
      }

      let permission = await locationPort.getForegroundPermission();
      if (permission === 'UNDETERMINED') {
        permission = await locationPort.requestForegroundPermission();
      }

      if (permission !== 'GRANTED') {
        setFailureKind('PERMISSION_DENIED');
        setManualVisible(true);
        return;
      }

      const coordinates = await locationPort.getCurrentCoordinates();
      const result = await serviceabilityPort.checkLocation(coordinates);
      if (result.kind === 'SERVICEABLE') {
        onLocationReady(coordinates);
      } else {
        setFailureKind(result.kind);
        setManualVisible(true);
      }
    } catch {
      setFailureKind('UNAVAILABLE');
      setManualVisible(true);
    } finally {
      setBusy(false);
    }
  };

  const verifyManualLocation = (): void => {
    const coordinates = parseManualCoordinates(latitudeInput, longitudeInput);
    if (coordinates === null) {
      setFailureKind('INVALID_MANUAL_LOCATION');
      return;
    }

    void verifyCoordinates(coordinates);
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Find fashion near you
      </Text>
      <Text style={styles.description}>
        Vastra uses your current area only to check nearby shop availability and delivery reach.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => {
          void useCurrentLocation();
        }}
        style={({ pressed }) => [
          styles.primaryAction,
          pressed ? styles.pressed : null,
          busy ? styles.disabled : null,
        ]}
      >
        <Text style={styles.primaryActionText}>
          {busy ? 'Checking location…' : 'Use current location'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter location manually"
        disabled={busy}
        onPress={() => {
          setManualVisible(true);
          setFailureKind(null);
        }}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryActionText}>Enter location manually</Text>
      </Pressable>

      {manualVisible ? (
        <View style={styles.manualPanel}>
          <Text accessibilityRole="header" style={styles.manualTitle}>
            Manual location
          </Text>
          <Text style={styles.manualDescription}>
            Enter latitude and longitude for the area you want Vastra to check. This does not create
            or save a delivery address.
          </Text>

          <Text style={styles.label}>Latitude</Text>
          <TextInput
            accessibilityLabel="Location latitude"
            editable={!busy}
            keyboardType="numbers-and-punctuation"
            onChangeText={setLatitudeInput}
            placeholder="13.6288"
            style={styles.input}
            value={latitudeInput}
          />

          <Text style={styles.label}>Longitude</Text>
          <TextInput
            accessibilityLabel="Location longitude"
            editable={!busy}
            keyboardType="numbers-and-punctuation"
            onChangeText={setLongitudeInput}
            placeholder="79.4192"
            style={styles.input}
            value={longitudeInput}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check manual location"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={verifyManualLocation}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed ? styles.pressed : null,
              busy ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryActionText}>Check this location</Text>
          </Pressable>
        </View>
      ) : null}

      {failureKind === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {customerLocationFailureMessage(failureKind)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#FFF8F2',
  },
  title: { color: '#241B16', fontSize: 28, fontWeight: '700' },
  description: { marginTop: 12, color: '#665A52', fontSize: 16, lineHeight: 24 },
  primaryAction: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryActionText: { color: '#6B2D38', fontSize: 15, fontWeight: '600' },
  manualPanel: { marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF' },
  manualTitle: { color: '#241B16', fontSize: 20, fontWeight: '700' },
  manualDescription: { marginTop: 8, color: '#665A52', fontSize: 14, lineHeight: 20 },
  label: { marginTop: 16, color: '#3B3029', fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    marginTop: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#B8AAA0',
    borderRadius: 12,
    color: '#241B16',
    fontSize: 16,
  },
  errorText: { marginTop: 16, color: '#A12032', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
