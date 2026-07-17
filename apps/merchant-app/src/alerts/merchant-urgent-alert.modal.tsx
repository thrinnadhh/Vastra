import { useAudioPlayer } from 'expo-audio';

import ringtoneSource from '../../assets/sounds/vastra_new_order.wav';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MerchantOrderReadPort } from '../orders/merchant-order.types';
import {
  merchantAlertSecondsRemaining,
  shouldStopMerchantAlertForOrderStatus,
} from './merchant-alert-countdown';
import type { MerchantOrderAlertClient } from './merchant-order-alert.client';
import { useMerchantAlertRuntime } from './merchant-alert-notification.runtime';

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes)}:${String(remaining).padStart(2, '0')}`;
}

export function MerchantUrgentAlertModal({
  alertClient,
  orderClient,
  onOpenOrder,
  authoritativePollIntervalMs = 5_000,
}: {
  readonly alertClient: MerchantOrderAlertClient;
  readonly orderClient: Pick<MerchantOrderReadPort, 'getOrder'>;
  readonly onOpenOrder: (orderId: string) => void;
  readonly authoritativePollIntervalMs?: number;
}) {
  const runtime = useMerchantAlertRuntime();
  const alert = runtime.activeAlert;
  const [now, setNow] = useState<number | null>(null);
  const remaining =
    alert === null || now === null ? null : merchantAlertSecondsRemaining(alert.expiresAt, now);
  const [acknowledging, setAcknowledging] = useState(false);
  const [failure, setFailure] = useState(false);
  const player = useAudioPlayer(ringtoneSource, { downloadFirst: true });

  useEffect(() => {
    if (alert === null || merchantAlertSecondsRemaining(alert.expiresAt) === 0) {
      player.pause();
      void player.seekTo(0);
      return;
    }

    const replay = () => {
      void player.seekTo(0).then(() => {
        player.play();
      });
    };
    replay();
    const timer = setInterval(replay, 1_100);
    return () => {
      clearInterval(timer);
      player.pause();
      void player.seekTo(0);
    };
  }, [alert, player]);

  useEffect(() => {
    if (alert === null) return;
    const update = () => {
      setNow(Date.now());
    };
    const initialTimer = setTimeout(update, 0);
    const timer = setInterval(update, 1_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [alert]);

  useEffect(() => {
    if (alert !== null && remaining === 0) {
      void runtime.clearActiveAlert();
    }
  }, [alert, remaining, runtime]);

  useEffect(() => {
    if (alert === null) return;
    let cancelled = false;

    const verifyAuthoritativeState = async (): Promise<void> => {
      try {
        const order = await orderClient.getOrder(alert.orderId);
        if (!cancelled && shouldStopMerchantAlertForOrderStatus(order.status)) {
          player.pause();
          void player.seekTo(0);
          await runtime.clearActiveAlert();
        }
      } catch {
        // A transient read failure must not hide a still-active urgent alert.
      }
    };

    void verifyAuthoritativeState();
    const timer = setInterval(() => void verifyAuthoritativeState(), authoritativePollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [alert, authoritativePollIntervalMs, orderClient, player, runtime]);

  const accessibilityLabel = useMemo(
    () =>
      alert === null
        ? 'No urgent merchant alert'
        : remaining === null
          ? `Urgent new order ${alert.orderNumber}. Countdown loading`
          : `Urgent new order ${alert.orderNumber}. ${String(remaining)} seconds remaining`,
    [alert, remaining],
  );

  if (alert === null) return null;

  const acknowledgeAndOpen = async (): Promise<void> => {
    if (acknowledging) return;
    setAcknowledging(true);
    setFailure(false);
    try {
      await alertClient.acknowledge(alert.alertId);
      player.pause();
      void player.seekTo(0);
      await runtime.clearActiveAlert();
      onOpenOrder(alert.orderId);
    } catch {
      setFailure(true);
    } finally {
      setAcknowledging(false);
    }
  };

  const actionDisabled = acknowledging || remaining === null || remaining === 0;

  return (
    <Modal animationType="fade" onRequestClose={() => undefined} transparent visible>
      <View accessibilityLabel={accessibilityLabel} accessible style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>URGENT NEW ORDER</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {alert.orderNumber}
          </Text>
          <Text style={styles.copy}>
            Review the authoritative order before accepting or rejecting it.
          </Text>
          <View style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>Response window</Text>
            <Text accessibilityLiveRegion="polite" style={styles.countdownValue}>
              {remaining === null ? '—:—' : formatCountdown(remaining)}
            </Text>
          </View>
          {failure ? (
            <Text accessibilityLiveRegion="assertive" style={styles.failure}>
              We could not acknowledge this alert. Check your connection and retry.
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel={`Acknowledge and open order ${alert.orderNumber}`}
            accessibilityRole="button"
            disabled={actionDisabled}
            onPress={() => void acknowledgeAndOpen()}
            style={[styles.primary, actionDisabled ? styles.disabled : null]}
          >
            <Text style={styles.primaryText}>
              {acknowledging ? 'Acknowledging…' : 'Acknowledge & review order'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(36, 27, 22, 0.72)',
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  eyebrow: { color: '#A52737', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#241B16', fontSize: 30, fontWeight: '900' },
  copy: { marginTop: 10, color: '#665A52', fontSize: 15, lineHeight: 22 },
  countdownCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFF1E8',
  },
  countdownLabel: { color: '#7B3440', fontSize: 13, fontWeight: '800' },
  countdownValue: { marginTop: 4, color: '#7B3440', fontSize: 34, fontWeight: '900' },
  failure: { marginTop: 16, color: '#9E1C2F', fontSize: 14, lineHeight: 20 },
  primary: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#8E3B46',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
