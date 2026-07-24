import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMerchantAlertRuntime } from '../alerts/merchant-alert-notification.runtime';
import type { MerchantAlertSetupState } from '../alerts/merchant-alert-notification.types';
import {
  MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS,
  MERCHANT_SPRINT_06_TEST_IDS,
} from '../sprint-06/merchant-fulfilment.integration-contract';

interface ReadinessCopy {
  readonly title: string;
  readonly description: string;
  readonly settingsRecovery: boolean;
}

export const MERCHANT_READINESS_COPY: Readonly<Record<MerchantAlertSetupState, ReadinessCopy>> = {
  CHECKING: {
    title: 'Checking new-order alerts',
    description: 'Vastra is verifying notification permission, the urgent channel and this device.',
    settingsRecovery: false,
  },
  READY: {
    title: 'New-order alerts are ready',
    description: 'This device can receive and present urgent merchant order alerts.',
    settingsRecovery: false,
  },
  PERMISSION_DENIED: {
    title: 'Allow merchant notifications',
    description: 'Notification permission is required before this device can handle new orders.',
    settingsRecovery: false,
  },
  PERMISSION_BLOCKED: {
    title: 'Notifications are blocked',
    description: 'Android will not ask again. Enable Vastra Merchant notifications in device settings.',
    settingsRecovery: true,
  },
  UNSUPPORTED_PLATFORM: {
    title: 'Android device required',
    description: 'Urgent merchant push delivery is supported on Android for the frozen MVP.',
    settingsRecovery: false,
  },
  PHYSICAL_DEVICE_REQUIRED: {
    title: 'Physical Android device required',
    description: 'A physical development build is required to obtain a native FCM token.',
    settingsRecovery: false,
  },
  CHANNEL_MISCONFIGURED: {
    title: 'Urgent order channel needs attention',
    description: 'Restore maximum importance, the Vastra ringtone and vibration in Android settings.',
    settingsRecovery: true,
  },
  TOKEN_UNAVAILABLE: {
    title: 'FCM token unavailable',
    description: 'The device could not obtain a native Firebase token. Check connectivity and retry.',
    settingsRecovery: false,
  },
  BACKEND_REGISTRATION_FAILED: {
    title: 'Device registration failed',
    description: 'The device token could not be registered for this merchant account.',
    settingsRecovery: false,
  },
  SESSION_EXPIRED: {
    title: 'Merchant session expired',
    description: 'Sign in again before registering this device or handling shop orders.',
    settingsRecovery: false,
  },
  OFFLINE_STALE: {
    title: 'Readiness could not be verified',
    description: 'Reconnect and retry. Vastra will not claim this device is ready from stale data.',
    settingsRecovery: false,
  },
};

export function MerchantReadinessGate({
  onOpenDiagnostics,
}: {
  readonly onOpenDiagnostics: () => void;
}): React.JSX.Element {
  const runtime = useMerchantAlertRuntime();
  const copy = MERCHANT_READINESS_COPY[runtime.setupState];
  const checking = runtime.setupState === 'CHECKING';

  return (
    <View
      accessibilityLabel="Merchant new-order alert setup required"
      style={styles.gate}
      testID={MERCHANT_SPRINT_06_TEST_IDS.readinessGate}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.description}>{copy.description}</Text>
      {runtime.diagnostics.failureReason === null ? null : (
        <Text accessibilityLiveRegion="assertive" style={styles.failure}>
          {runtime.diagnostics.failureReason}
        </Text>
      )}

      <Pressable
        accessibilityLabel={MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS.openAlertDiagnostics}
        accessibilityRole="button"
        onPress={onOpenDiagnostics}
        style={styles.primary}
      >
        <Text style={styles.primaryText}>Open alert diagnostics</Text>
      </Pressable>

      <Pressable
        accessibilityLabel={MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS.retryReadiness}
        accessibilityRole="button"
        disabled={checking}
        onPress={() => void runtime.refreshSetup()}
        style={[styles.secondary, checking ? styles.disabled : null]}
        testID={MERCHANT_SPRINT_06_TEST_IDS.readinessRetry}
      >
        <Text style={styles.secondaryText}>{checking ? 'Checking…' : 'Retry readiness'}</Text>
      </Pressable>

      {copy.settingsRecovery ? (
        <Pressable
          accessibilityLabel="Open Android settings for merchant alerts"
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
          style={styles.settings}
        >
          <Text style={styles.settingsText}>Open Android settings</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFF8F2',
  },
  title: {
    color: '#241B16',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    maxWidth: 460,
    color: '#665A52',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  failure: {
    marginTop: 14,
    maxWidth: 460,
    color: '#9E1C2F',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primary: {
    marginTop: 22,
    minHeight: 48,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#8E3B46',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: {
    marginTop: 12,
    minHeight: 48,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  secondaryText: { color: '#8E3B46', fontSize: 15, fontWeight: '900' },
  settings: { minHeight: 48, justifyContent: 'center', marginTop: 8, paddingHorizontal: 16 },
  settingsText: {
    color: '#2857A6',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  disabled: { opacity: 0.55 },
});
