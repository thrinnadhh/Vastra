import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS,
  MERCHANT_SPRINT_06_TEST_IDS,
} from '../sprint-06/merchant-fulfilment.integration-contract';
import {
  MerchantHandoverError,
  type MerchantDeliveryProjection,
  type MerchantOrderHandoverPort,
  type MerchantPickupCode,
} from './merchant-order-handover.types';

function asHandoverError(error: unknown): MerchantHandoverError {
  return error instanceof MerchantHandoverError
    ? error
    : new MerchantHandoverError('UNKNOWN', null, false);
}

function errorMessage(error: MerchantHandoverError): string {
  switch (error.kind) {
    case 'TRANSPORT':
      return 'You appear to be offline. Reconnect and refresh captain state.';
    case 'AUTHENTICATION':
      return 'Your merchant session expired. Sign in again.';
    case 'FORBIDDEN':
      return 'This account cannot read handover details for this order.';
    case 'NOT_FOUND':
      return 'Delivery handover is not available for this shop order.';
    case 'INVALID_STATE':
      return 'The delivery state changed. Refresh before revealing the pickup code.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Captain and pickup state is temporarily unavailable.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not verify the latest handover state.';
  }
}

function stateCopy(delivery: MerchantDeliveryProjection): {
  readonly title: string;
  readonly detail: string;
} {
  if (delivery.pickedUpAt !== null || delivery.taskStatus === 'PICKED_UP') {
    return {
      title: 'Pickup confirmed',
      detail: 'The captain pickup was confirmed by the authoritative delivery state.',
    };
  }
  if (delivery.captainAtStore || delivery.taskStatus === 'AT_PICKUP') {
    return {
      title: 'Captain is at the store',
      detail: 'Verify the captain in person, then reveal the pickup code for handover.',
    };
  }
  if (delivery.captainAssigned || delivery.taskStatus === 'ASSIGNED') {
    return {
      title: 'Captain assigned',
      detail: 'Keep the packed order ready. The pickup code remains hidden until arrival.',
    };
  }
  return {
    title: 'Searching for a captain',
    detail: 'Dispatch is finding an eligible captain. Refreshing will not change server state.',
  };
}

export function MerchantOrderHandoverActions({
  orderId,
  handoverClient,
  pollIntervalMs = 5_000,
  onAuthoritativePickupConfirmed,
  onSessionExpired,
}: {
  readonly orderId: string;
  readonly handoverClient: MerchantOrderHandoverPort;
  readonly pollIntervalMs?: number;
  readonly onAuthoritativePickupConfirmed: () => void;
  readonly onSessionExpired: () => void;
}): React.JSX.Element {
  const [delivery, setDelivery] = useState<MerchantDeliveryProjection | null>(null);
  const [pickupCode, setPickupCode] = useState<MerchantPickupCode | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isRevealing, setRevealing] = useState(false);
  const [failure, setFailure] = useState<MerchantHandoverError | null>(null);
  const mounted = useRef(true);
  const requestInFlight = useRef(false);
  const revealInFlight = useRef(false);
  const pickupReported = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    try {
      const next = await handoverClient.getDelivery(orderId);
      if (!mounted.current) return;
      setDelivery(next);
      setFailure(null);
      if (!next.captainAtStore || next.pickedUpAt !== null || next.taskStatus === 'PICKED_UP') {
        setPickupCode(null);
      }
      if (
        !pickupReported.current &&
        (next.pickedUpAt !== null || next.taskStatus === 'PICKED_UP')
      ) {
        pickupReported.current = true;
        onAuthoritativePickupConfirmed();
      }
    } catch (error: unknown) {
      if (!mounted.current) return;
      const nextFailure = asHandoverError(error);
      setFailure(nextFailure);
      if (nextFailure.kind === 'AUTHENTICATION') onSessionExpired();
    } finally {
      if (mounted.current) setLoading(false);
      requestInFlight.current = false;
    }
  }, [handoverClient, onAuthoritativePickupConfirmed, onSessionExpired, orderId]);

  const revealPickupCode = useCallback(async (): Promise<void> => {
    if (
      revealInFlight.current ||
      delivery === null ||
      !delivery.captainAtStore ||
      delivery.pickedUpAt !== null
    ) {
      return;
    }
    revealInFlight.current = true;
    setRevealing(true);
    setFailure(null);
    try {
      const next = await handoverClient.getPickupCode(orderId);
      if (!mounted.current) return;
      setPickupCode(next);
    } catch (error: unknown) {
      if (!mounted.current) return;
      const nextFailure = asHandoverError(error);
      setPickupCode(null);
      setFailure(nextFailure);
      if (nextFailure.kind === 'AUTHENTICATION') onSessionExpired();
      if (nextFailure.kind === 'INVALID_STATE') void load();
    } finally {
      if (mounted.current) setRevealing(false);
      revealInFlight.current = false;
    }
  }, [delivery, handoverClient, load, onSessionExpired, orderId]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = () => {
      void load().finally(() => {
        if (!cancelled && pollIntervalMs > 0 && !pickupReported.current) {
          timer = setTimeout(poll, pollIntervalMs);
        }
      });
    };
    void Promise.resolve().then(poll);
    return () => {
      cancelled = true;
      mounted.current = false;
      setPickupCode(null);
      if (timer !== null) clearTimeout(timer);
    };
  }, [load, pollIntervalMs]);

  if (delivery === null && isLoading) {
    return (
      <View style={styles.card} testID={MERCHANT_SPRINT_06_TEST_IDS.handoverState}>
        <ActivityIndicator accessibilityLabel="Loading merchant captain and handover state" />
        <Text style={styles.centerCopy}>Checking captain and pickup state…</Text>
      </View>
    );
  }

  if (delivery === null && failure !== null) {
    return (
      <View style={styles.card} testID={MERCHANT_SPRINT_06_TEST_IDS.handoverState}>
        <Text accessibilityRole="header" style={styles.title}>
          Handover unavailable
        </Text>
        <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
          {errorMessage(failure)}
        </Text>
        <Pressable
          accessibilityLabel={MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS.refreshCaptainState}
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void load()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Retry captain state</Text>
        </Pressable>
      </View>
    );
  }

  if (delivery === null) return <></>;
  const copy = stateCopy(delivery);
  const pickedUp = delivery.pickedUpAt !== null || delivery.taskStatus === 'PICKED_UP';
  const canReveal = delivery.captainAtStore && !pickedUp;
  const codeExpired = pickupCode !== null && Date.parse(pickupCode.expiresAt) <= Date.now();

  return (
    <View style={styles.card} testID={MERCHANT_SPRINT_06_TEST_IDS.handoverState}>
      <Text style={styles.eyebrow}>CAPTAIN HANDOVER</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.copy}>{copy.detail}</Text>
      <View
        accessible
        accessibilityLabel={`Captain state ${delivery.taskStatus}`}
        style={styles.state}
        testID={MERCHANT_SPRINT_06_TEST_IDS.captainState}
      >
        <Text style={styles.stateLabel}>DELIVERY STATE</Text>
        <Text style={styles.stateValue}>{delivery.taskStatus.replaceAll('_', ' ')}</Text>
      </View>

      {failure === null ? null : (
        <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
          {errorMessage(failure)}
        </Text>
      )}

      {canReveal && pickupCode === null ? (
        <Pressable
          accessibilityLabel={MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS.revealPickupCode}
          accessibilityRole="button"
          disabled={isRevealing}
          onPress={() => void revealPickupCode()}
          style={[styles.primary, isRevealing ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>
            {isRevealing ? 'Verifying state…' : 'Reveal pickup code'}
          </Text>
        </Pressable>
      ) : null}

      {pickupCode !== null && !codeExpired && canReveal ? (
        <View
          accessible
          accessibilityLabel="Authorized pickup code is visible"
          style={styles.codeCard}
          testID={MERCHANT_SPRINT_06_TEST_IDS.pickupCode}
        >
          <Text style={styles.codeLabel}>PICKUP CODE</Text>
          <Text selectable={false} style={styles.codeValue}>
            {pickupCode.secret}
          </Text>
          <Text style={styles.codeWarning}>
            Show this code only to the verified captain standing at the store.
          </Text>
          <Pressable
            accessibilityLabel="Hide merchant pickup code"
            accessibilityRole="button"
            onPress={() => setPickupCode(null)}
            style={styles.hideCode}
          >
            <Text style={styles.hideCodeText}>Hide code</Text>
          </Pressable>
        </View>
      ) : null}

      {codeExpired ? (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Pickup code expired</Text>
          <Text style={styles.copy}>Hide the old code and request a current one.</Text>
          <Pressable
            accessibilityLabel="Request a new merchant pickup code"
            accessibilityRole="button"
            disabled={isRevealing}
            onPress={() => {
              setPickupCode(null);
              void revealPickupCode();
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Request current code</Text>
          </Pressable>
        </View>
      ) : null}

      {pickedUp ? (
        <View accessible accessibilityLabel="Merchant pickup authoritatively confirmed" style={styles.complete}>
          <Text style={styles.completeTitle}>Handover complete</Text>
          <Text style={styles.completeCopy}>
            The code is no longer available because pickup has been confirmed by the server.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS.refreshCaptainState}
        accessibilityRole="button"
        disabled={isLoading}
        onPress={() => void load()}
        style={[styles.refresh, isLoading ? styles.disabled : null]}
      >
        <Text style={styles.secondaryText}>{isLoading ? 'Refreshing…' : 'Refresh captain state'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF' },
  centerCopy: { marginTop: 10, color: '#665A52', textAlign: 'center' },
  eyebrow: { color: '#2857A6', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 6, color: '#241B16', fontSize: 18, fontWeight: '900' },
  copy: { marginTop: 6, color: '#665A52', lineHeight: 20 },
  state: { marginTop: 14, padding: 13, borderRadius: 14, backgroundColor: '#EEF5FF' },
  stateLabel: { color: '#2857A6', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  stateValue: { marginTop: 4, color: '#192F55', fontSize: 14, fontWeight: '900' },
  errorText: { marginTop: 12, color: '#9A3F3F', lineHeight: 20 },
  primary: {
    minHeight: 48,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#8E3B46',
    paddingHorizontal: 16,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  secondary: {
    minHeight: 48,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  secondaryText: { color: '#8E3B46', fontWeight: '900' },
  codeCard: { marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: '#F4E3D9' },
  codeLabel: { color: '#7B3440', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  codeValue: { marginTop: 8, color: '#241B16', fontSize: 34, fontWeight: '900', letterSpacing: 8 },
  codeWarning: { marginTop: 10, color: '#665A52', lineHeight: 19 },
  hideCode: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 },
  hideCodeText: { color: '#2857A6', fontWeight: '900', textDecorationLine: 'underline' },
  warning: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#FFF1D6' },
  warningTitle: { color: '#6A4812', fontWeight: '900' },
  complete: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#E7F3EC' },
  completeTitle: { color: '#235E42', fontWeight: '900' },
  completeCopy: { marginTop: 4, color: '#235E42', lineHeight: 20 },
  refresh: {
    minHeight: 48,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.55 },
});
