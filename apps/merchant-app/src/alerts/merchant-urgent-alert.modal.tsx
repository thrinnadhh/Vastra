import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import ringtoneSource from '../../assets/sounds/vastra_new_order.wav';
import { MerchantOrderDecisionActions } from '../orders/merchant-order-decision.screen';
import type {
  MerchantOrderDecisionPort,
  MerchantOrderDetail,
  MerchantOrderReadPort,
} from '../orders/merchant-order.types';
import { MERCHANT_SPRINT_06_TEST_IDS } from '../sprint-06/merchant-fulfilment.integration-contract';
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
  decisionClient,
  onOpenOrder,
  authoritativePollIntervalMs = 5_000,
}: {
  readonly alertClient: MerchantOrderAlertClient;
  readonly orderClient: Pick<MerchantOrderReadPort, 'getOrder'>;
  readonly decisionClient?: MerchantOrderDecisionPort;
  readonly onOpenOrder: (orderId: string) => void;
  readonly authoritativePollIntervalMs?: number;
}): React.JSX.Element | null {
  const runtime = useMerchantAlertRuntime();
  const alert = runtime.activeAlert;
  const [now, setNow] = useState<number | null>(null);
  const remaining =
    alert === null || now === null ? null : merchantAlertSecondsRemaining(alert.expiresAt, now);
  const [acknowledging, setAcknowledging] = useState(false);
  const acknowledgingRef = useRef(false);
  const [acknowledgementFailure, setAcknowledgementFailure] = useState(false);
  const [authoritativeOrder, setAuthoritativeOrder] = useState<MerchantOrderDetail | null>(null);
  const [authoritativeUnavailable, setAuthoritativeUnavailable] = useState(false);
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
      void Promise.resolve().then(() => {
        setAuthoritativeOrder(null);
        void runtime.clearActiveAlert();
      });
    }
  }, [alert, remaining, runtime]);

  const verifyAuthoritativeState = useCallback(async (): Promise<void> => {
    if (alert === null) return;
    try {
      const order = await orderClient.getOrder(alert.orderId);
      setAuthoritativeUnavailable(false);
      setAuthoritativeOrder(order);
      if (shouldStopMerchantAlertForOrderStatus(order.status)) {
        player.pause();
        void player.seekTo(0);
        setAuthoritativeOrder(null);
        await runtime.clearActiveAlert();
      }
    } catch {
      setAuthoritativeUnavailable(true);
      // A transient read failure must not hide a still-active urgent alert.
    }
  }, [alert, orderClient, player, runtime]);

  useEffect(() => {
    if (alert === null) return;
    let cancelled = false;
    const verify = async (): Promise<void> => {
      if (!cancelled) await verifyAuthoritativeState();
    };
    void verify();
    const timer = setInterval(() => void verify(), authoritativePollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [alert, authoritativePollIntervalMs, verifyAuthoritativeState]);

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

  const stopAndOpen = async (): Promise<void> => {
    player.pause();
    void player.seekTo(0);
    setAuthoritativeOrder(null);
    await runtime.clearActiveAlert();
    onOpenOrder(alert.orderId);
  };

  const acknowledgeAndOpen = async (): Promise<void> => {
    if (acknowledgingRef.current) return;
    acknowledgingRef.current = true;
    setAcknowledging(true);
    setAcknowledgementFailure(false);
    try {
      await alertClient.acknowledge(alert.alertId);
      await stopAndOpen();
    } catch {
      setAcknowledgementFailure(true);
    } finally {
      acknowledgingRef.current = false;
      setAcknowledging(false);
    }
  };

  const actionDisabled = acknowledging || remaining === null || remaining === 0;

  return (
    <Modal animationType="fade" onRequestClose={() => undefined} transparent visible>
      <View
        accessibilityLabel={accessibilityLabel}
        accessible
        style={styles.backdrop}
        testID={MERCHANT_SPRINT_06_TEST_IDS.urgentAlert}
      >
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
          {authoritativeUnavailable ? (
            <Text accessibilityLiveRegion="assertive" style={styles.failure}>
              Authoritative order state is temporarily unavailable. The valid alert remains active.
            </Text>
          ) : null}
          {acknowledgementFailure ? (
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

          {decisionClient !== undefined && authoritativeOrder?.status === 'WAITING_FOR_MERCHANT' ? (
            <MerchantOrderDecisionActions
              context="URGENT_ALERT"
              decisionClient={decisionClient}
              onAuthoritativeRefreshRequested={() => void verifyAuthoritativeState()}
              onDecisionComplete={() => void stopAndOpen()}
              order={authoritativeOrder}
            />
          ) : null}
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
    maxHeight: '92%',
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
    minHeight: 48,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E3B46',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
