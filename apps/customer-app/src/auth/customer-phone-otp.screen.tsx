import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getOtpResendRemainingSeconds,
  isValidOtpCode,
  normalizeIndianPhone,
  PhoneOtpError,
  phoneOtpErrorMessage,
  type PhoneOtpErrorKind,
  type PhoneOtpPort,
} from './phone-otp.types';

const OTP_RESEND_COOLDOWN_MS = 30_000;

type PhoneOtpStep = 'PHONE' | 'OTP';

function asPhoneOtpErrorKind(error: unknown): PhoneOtpErrorKind {
  return error instanceof PhoneOtpError ? error.kind : 'UNAVAILABLE';
}

export function CustomerPhoneOtpScreen({ otpPort }: { readonly otpPort: PhoneOtpPort }) {
  const [step, setStep] = useState<PhoneOtpStep>('PHONE');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cooldownUntilMs, setCooldownUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errorKind, setErrorKind] = useState<PhoneOtpErrorKind | null>(null);

  const resendRemainingSeconds = getOtpResendRemainingSeconds(cooldownUntilMs, nowMs);

  useEffect(() => {
    if (step !== 'OTP' || resendRemainingSeconds === 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [resendRemainingSeconds, step]);

  const requestCode = async (): Promise<void> => {
    const normalizedPhone = normalizeIndianPhone(phoneInput);
    if (normalizedPhone === null) {
      setErrorKind('INVALID_PHONE');
      return;
    }

    setBusy(true);
    setErrorKind(null);

    try {
      await otpPort.requestOtp(normalizedPhone);
      const requestedAt = Date.now();
      setPhoneE164(normalizedPhone);
      setCooldownUntilMs(requestedAt + OTP_RESEND_COOLDOWN_MS);
      setNowMs(requestedAt);
      setStep('OTP');
    } catch (error: unknown) {
      setErrorKind(asPhoneOtpErrorKind(error));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async (): Promise<void> => {
    if (phoneE164 === null || resendRemainingSeconds > 0 || busy) {
      return;
    }

    setBusy(true);
    setErrorKind(null);

    try {
      await otpPort.requestOtp(phoneE164);
      const requestedAt = Date.now();
      setCooldownUntilMs(requestedAt + OTP_RESEND_COOLDOWN_MS);
      setNowMs(requestedAt);
    } catch (error: unknown) {
      setErrorKind(asPhoneOtpErrorKind(error));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (): Promise<void> => {
    if (phoneE164 === null || !isValidOtpCode(code)) {
      setErrorKind('INVALID_CODE');
      return;
    }

    setBusy(true);
    setErrorKind(null);

    try {
      await otpPort.verifyOtp(phoneE164, code);
      setVerified(true);
    } catch (error: unknown) {
      setErrorKind(asPhoneOtpErrorKind(error));
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Code accepted
        </Text>
        <Text style={styles.description}>Restoring your secure customer session.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {step === 'PHONE' ? 'Sign in with your phone' : 'Enter your secure code'}
      </Text>

      <Text style={styles.description}>
        {step === 'PHONE'
          ? 'We will send a one-time code to an Indian mobile number.'
          : 'Enter the 6-digit code sent to your mobile number.'}
      </Text>

      {step === 'PHONE' ? (
        <>
          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            accessibilityLabel="Mobile number"
            autoComplete="tel"
            editable={!busy}
            keyboardType="phone-pad"
            onChangeText={setPhoneInput}
            placeholder="9876543210"
            style={styles.input}
            value={phoneInput}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send secure code"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => {
              void requestCode();
            }}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed ? styles.pressed : null,
              busy ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryActionText}>{busy ? 'Sending code…' : 'Send code'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>One-time code</Text>
          <TextInput
            accessibilityLabel="One-time code"
            editable={!busy}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setCode}
            placeholder="000000"
            style={styles.input}
            textContentType="oneTimeCode"
            value={code}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verify secure code"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => {
              void verifyCode();
            }}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed ? styles.pressed : null,
              busy ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryActionText}>{busy ? 'Verifying…' : 'Verify code'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resend secure code"
            accessibilityState={{ disabled: busy || resendRemainingSeconds > 0 }}
            disabled={busy || resendRemainingSeconds > 0}
            onPress={() => {
              void resendCode();
            }}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>
              {resendRemainingSeconds > 0
                ? `Resend available in ${String(resendRemainingSeconds)} seconds`
                : 'Resend code'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change mobile number"
            disabled={busy}
            onPress={() => {
              setStep('PHONE');
              setCode('');
              setErrorKind(null);
            }}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Change mobile number</Text>
          </Pressable>
        </>
      )}

      {errorKind === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {phoneOtpErrorMessage(errorKind)}
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
  title: {
    color: '#241B16',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    marginTop: 28,
    color: '#3B3029',
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    marginTop: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#B8AAA0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#241B16',
    fontSize: 18,
  },
  primaryAction: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    minHeight: 48,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#6B2D38',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
  errorText: {
    marginTop: 16,
    color: '#A12032',
    fontSize: 14,
    lineHeight: 20,
  },
});
