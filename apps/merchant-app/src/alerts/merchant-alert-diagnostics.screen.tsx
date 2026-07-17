import { useAudioPlayer } from 'expo-audio';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMerchantAlertRuntime } from './merchant-alert-notification.runtime';

const RINGTONE = require('../../assets/sounds/vastra_new_order.wav') as number;

function StatusRow({
  label,
  ready,
  detail,
}: {
  readonly label: string;
  readonly ready: boolean;
  readonly detail: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Text accessibilityLabel={`${label}: ${ready ? 'ready' : 'needs attention'}`} style={ready ? styles.ready : styles.attention}>
        {ready ? 'READY' : 'CHECK'}
      </Text>
    </View>
  );
}

export function MerchantAlertDiagnosticsScreen({ onBack }: { readonly onBack: () => void }) {
  const runtime = useMerchantAlertRuntime();
  const [testing, setTesting] = useState(false);
  const [testFailure, setTestFailure] = useState<string | null>(null);
  const player = useAudioPlayer(RINGTONE, { downloadFirst: true });
  const diagnostics = runtime.diagnostics;

  const testRingtone = async (): Promise<void> => {
    if (testing) return;
    setTesting(true);
    setTestFailure(null);
    try {
      player.loop = false;
      await player.seekTo(0);
      player.play();
      await runtime.testNotification();
    } catch (error: unknown) {
      setTestFailure(error instanceof Error ? error.message : 'Ringtone test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityLabel="Back to merchant orders" accessibilityRole="button" onPress={onBack}>
        <Text style={styles.back}>‹ Orders</Text>
      </Pressable>
      <Text style={styles.eyebrow}>ALERT DIAGNOSTICS</Text>
      <Text accessibilityRole="header" style={styles.title}>
        New-order ringtone setup
      </Text>
      <Text style={styles.description}>
        Check the exact Android path used for urgent Vastra orders. Battery optimisation and manufacturer background restrictions must still be reviewed in device settings.
      </Text>

      <View style={styles.card}>
        <StatusRow label="Physical Android device" ready={diagnostics.physicalDevice} detail="FCM tokens are unavailable on emulators and web." />
        <StatusRow label="Notification permission" ready={diagnostics.permissionGranted} detail="Android 13+ requires explicit permission." />
        <StatusRow label="Urgent order channel" ready={diagnostics.channelReady} detail="Channel: vastra_urgent_orders, maximum importance." />
        <StatusRow label="Custom ringtone" ready={diagnostics.customSoundReady} detail="Bundled sound: vastra_new_order.wav." />
        <StatusRow label="Strong vibration" ready={diagnostics.vibrationReady} detail="The urgent channel uses a repeated vibration pattern." />
        <StatusRow label="Native FCM token" ready={diagnostics.pushTokenReady} detail="The device token is read from Android, not Expo Push Service." />
        <StatusRow label="Backend registration" ready={diagnostics.backendRegistrationReady} detail="The active merchant device is registered through /me/devices." />
      </View>

      {diagnostics.failureReason === null ? null : (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Setup needs attention</Text>
          <Text style={styles.warningCopy}>{diagnostics.failureReason}</Text>
        </View>
      )}

      <Pressable
        accessibilityLabel="Refresh merchant alert setup"
        accessibilityRole="button"
        onPress={() => void runtime.refreshSetup()}
        style={styles.primary}
      >
        <Text style={styles.primaryText}>Refresh setup</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Test merchant order ringtone"
        accessibilityRole="button"
        disabled={testing}
        onPress={() => void testRingtone()}
        style={[styles.secondary, testing ? styles.disabled : null]}
      >
        <Text style={styles.secondaryText}>{testing ? 'Testing…' : 'Test ringtone & notification'}</Text>
      </Pressable>
      {testFailure === null ? null : (
        <Text accessibilityLiveRegion="assertive" style={styles.testFailure}>
          {testFailure}
        </Text>
      )}
      <Pressable
        accessibilityLabel="Open Android notification settings"
        accessibilityRole="button"
        onPress={() => void Linking.openSettings()}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Open device settings</Text>
      </Pressable>

      <View style={styles.guidance}>
        <Text style={styles.guidanceTitle}>Background delivery checklist</Text>
        <Text style={styles.guidanceCopy}>• Allow notifications and sound for Vastra Merchant.</Text>
        <Text style={styles.guidanceCopy}>• Keep the urgent order channel enabled at high importance.</Text>
        <Text style={styles.guidanceCopy}>• Exclude the app from aggressive battery optimisation where the device manufacturer requires it.</Text>
        <Text style={styles.guidanceCopy}>• Confirm alerts in foreground, background, killed-app, and locked-screen states.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, backgroundColor: '#FFF8F2' },
  back: { marginBottom: 16, color: '#8E3B46', fontSize: 16, fontWeight: '800' },
  eyebrow: { color: '#8E3B46', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 7, color: '#241B16', fontSize: 29, fontWeight: '900' },
  description: { marginTop: 10, color: '#665A52', fontSize: 15, lineHeight: 22 },
  card: { marginTop: 22, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1E8E2' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#241B16', fontSize: 15, fontWeight: '800' },
  rowDetail: { marginTop: 3, color: '#665A52', fontSize: 12, lineHeight: 17 },
  ready: { color: '#1F6B45', fontSize: 11, fontWeight: '900' },
  attention: { color: '#A05A11', fontSize: 11, fontWeight: '900' },
  warning: { marginTop: 18, padding: 15, borderRadius: 16, backgroundColor: '#FFF1D6' },
  warningTitle: { color: '#6A4812', fontWeight: '900' },
  warningCopy: { marginTop: 4, color: '#6A4812', lineHeight: 20 },
  primary: { marginTop: 20, padding: 15, borderRadius: 15, alignItems: 'center', backgroundColor: '#8E3B46' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: '#8E3B46', borderRadius: 15, alignItems: 'center' },
  secondaryText: { color: '#8E3B46', fontSize: 15, fontWeight: '900' },
  testFailure: { marginTop: 12, color: '#9E1C2F', textAlign: 'center' },
  linkButton: { marginTop: 14, alignItems: 'center' },
  linkText: { color: '#8E3B46', fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  guidance: { marginTop: 24, padding: 18, borderRadius: 18, backgroundColor: '#F4E3D9' },
  guidanceTitle: { color: '#7B3440', fontSize: 16, fontWeight: '900' },
  guidanceCopy: { marginTop: 7, color: '#665A52', fontSize: 13, lineHeight: 19 },
  disabled: { opacity: 0.55 },
});
