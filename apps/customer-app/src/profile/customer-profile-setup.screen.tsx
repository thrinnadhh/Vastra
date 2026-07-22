import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  normalizeCustomerFullName,
  type CustomerProfileSetupPort,
} from './customer-profile-setup.types';

export function CustomerProfileSetupScreen({
  initialFullName = '',
  profilePort,
  onCompleted,
}: {
  readonly initialFullName?: string;
  readonly profilePort: CustomerProfileSetupPort;
  readonly onCompleted: (fullName: string) => void;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveProfile = async (): Promise<void> => {
    if (busy) {
      return;
    }

    const normalized = normalizeCustomerFullName(fullName);
    if (normalized === null) {
      setMessage('Enter your name using 2 to 120 characters.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await profilePort.save(normalized);
      if (result.kind === 'SAVED') {
        onCompleted(result.fullName);
        return;
      }

      setMessage(
        result.kind === 'INVALID'
          ? 'Check your name and try again.'
          : 'We could not save your profile. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Complete your profile
      </Text>
      <Text style={styles.description}>
        Add the name you want Vastra to use for your account and orders. You can edit it later.
      </Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        accessibilityLabel="Full name"
        autoCapitalize="words"
        autoComplete="name"
        editable={!busy}
        maxLength={120}
        onChangeText={setFullName}
        placeholder="Your name"
        style={styles.input}
        value={fullName}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save customer profile"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => {
          void saveProfile();
        }}
        style={({ pressed }) => [
          styles.action,
          pressed ? styles.pressed : null,
          busy ? styles.disabled : null,
        ]}
      >
        <Text style={styles.actionText}>{busy ? 'Saving profile…' : 'Continue'}</Text>
      </Pressable>

      {message === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#FFF8F2',
  },
  title: { color: '#241B16', fontSize: 28, fontWeight: '700' },
  description: { marginTop: 12, color: '#665A52', fontSize: 16, lineHeight: 24 },
  label: { marginTop: 28, color: '#3B3029', fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 48,
    marginTop: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#B8AAA0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#241B16',
    fontSize: 17,
  },
  action: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  error: { marginTop: 16, color: '#A12032', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
