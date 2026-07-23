import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomerOrderError, type CustomerOrderStatus } from './customer-order.types';
import type {
  CustomerDeliveryOtp,
  CustomerOrderTrackingPort,
  CustomerOrderTrackingSnapshot,
} from './customer-order-tracking.types';
import { getCustomerOrderStatusPresentation } from './customer-order-status';

interface TrackingState {
  readonly tracking: CustomerOrderTrackingSnapshot | null;
  readonly otp: CustomerDeliveryOtp | null;
  readonly loading: boolean;
  readonly failure: CustomerOrderError | null;
}

function toError(error: unknown): CustomerOrderError {
  return error instanceof CustomerOrderError
    ? error
    : new CustomerOrderError('UNKNOWN', null, false);
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CustomerOrderTracking({
  orderId,
  orderStatus,
  trackingClient,
}: {
  readonly orderId: string;
  readonly orderStatus: CustomerOrderStatus;
  readonly trackingClient?: CustomerOrderTrackingPort;
}) {
  const presentation = getCustomerOrderStatusPresentation(orderStatus);
  const trackingAvailability = presentation.trackingAvailability;
  const canTrack = trackingAvailability === 'AVAILABLE';
  const canShowOtp = presentation.deliveryOtpVisibility === 'VISIBLE';
  const operation = useRef(0);
  const [state, setState] = useState<TrackingState>({
    tracking: null,
    otp: null,
    loading: canTrack && trackingClient !== undefined,
    failure: null,
  });

  const load = useCallback(() => {
    if (!canTrack || trackingClient === undefined) return;
    const current = ++operation.current;
    setState((previous) => ({
      ...previous,
      loading: true,
      failure: null,
      otp: canShowOtp ? previous.otp : null,
    }));
    void trackingClient.getTracking(orderId).then(
      (tracking) => {
        if (operation.current !== current) return;
        setState((previous) => ({ ...previous, tracking, loading: false, failure: null }));
        if (!canShowOtp) return;
        void trackingClient.getDeliveryOtp(orderId).then(
          (otp) => {
            if (operation.current === current) setState((previous) => ({ ...previous, otp }));
          },
          (error: unknown) => {
            if (operation.current !== current) return;
            const failure = toError(error);
            if (failure.kind === 'AUTHENTICATION') {
              setState((previous) => ({ ...previous, failure }));
            }
          },
        );
      },
      (error: unknown) => {
        if (operation.current === current) {
          setState((previous) => ({ ...previous, loading: false, failure: toError(error) }));
        }
      },
    );
  }, [canShowOtp, canTrack, orderId, trackingClient]);

  useEffect(() => {
    const scheduledLoad = Promise.resolve().then(load);
    void scheduledLoad;
    return () => {
      operation.current += 1;
    };
  }, [load]);

  const message = useMemo(() => {
    if (trackingAvailability === 'NOT_STARTED') {
      return 'Live delivery tracking has not started yet.';
    }
    if (trackingAvailability === 'UNAVAILABLE') {
      return 'Live delivery tracking is unavailable for this order stage.';
    }
    if (trackingClient === undefined)
      return 'Live delivery tracking is not connected on this surface.';
    if (state.loading && state.tracking === null) return 'Loading current delivery tracking.';
    if (state.failure?.kind === 'AUTHENTICATION')
      return 'Your session expired. Sign in again to view tracking.';
    if (state.failure?.kind === 'TRANSPORT') return 'Tracking could not refresh while offline.';
    if (state.failure !== null && state.tracking === null)
      return 'Live tracking is temporarily unavailable.';
    if (state.tracking?.location === null)
      return 'The delivery partner location is not available yet.';
    if (state.tracking?.location.stale === true)
      return 'The last location is old. The delivery partner may have moved.';
    return 'The location below is the latest update from the delivery service.';
  }, [state, trackingAvailability, trackingClient]);

  return (
    <View accessible accessibilityLiveRegion="polite" style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Delivery tracking
      </Text>
      <Text style={styles.message}>{message}</Text>
      {state.tracking?.captain === null || state.tracking === null ? null : (
        <View style={styles.section}>
          <Text style={styles.strong}>
            {state.tracking.captain.displayName ?? 'Delivery partner'}
          </Text>
          <Text style={styles.meta}>
            {[
              state.tracking.captain.vehicleType,
              state.tracking.captain.vehicleNumberLast4 === null
                ? null
                : `vehicle ending ${state.tracking.captain.vehicleNumberLast4}`,
              state.tracking.captain.phoneLast4 === null
                ? null
                : `phone ending ${state.tracking.captain.phoneLast4}`,
            ]
              .filter((value): value is string => value !== null)
              .join(' · ')}
          </Text>
        </View>
      )}
      {state.tracking?.location === null || state.tracking === null ? null : (
        <Text
          accessibilityLabel={`Location updated ${state.tracking.location.recordedAt}${state.tracking.location.stale ? ', stale' : ''}`}
          style={styles.meta}
        >
          Location updated {formatTime(state.tracking.location.recordedAt)}
          {state.tracking.location.stale ? ' · STALE' : ''}
        </Text>
      )}
      {state.tracking?.estimatedArrivalAt === null || state.tracking === null ? null : (
        <Text style={styles.meta}>
          Estimated arrival {formatTime(state.tracking.estimatedArrivalAt)}
        </Text>
      )}
      {!canShowOtp ? null : state.otp === null ? (
        <Text accessibilityLabel="Delivery OTP unavailable" style={styles.otpUnavailable}>
          Delivery OTP is not available yet. Do not share any other code.
        </Text>
      ) : (
        <View accessible accessibilityLabel={`Delivery OTP ${state.otp.secret}`} style={styles.otp}>
          <Text style={styles.otpLabel}>DELIVERY OTP</Text>
          <Text style={styles.otpValue}>{state.otp.secret}</Text>
          <Text style={styles.meta}>Share only after checking the parcel.</Text>
        </View>
      )}
      {!canTrack || trackingClient === undefined ? null : (
        <Pressable
          accessibilityLabel="Refresh delivery tracking"
          accessibilityRole="button"
          accessibilityState={{ disabled: state.loading }}
          disabled={state.loading}
          onPress={load}
          style={styles.action}
        >
          <Text style={styles.actionText}>
            {state.loading ? 'Refreshing…' : 'Refresh tracking'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  title: { color: '#1F2937', fontSize: 18, fontWeight: '700' },
  message: { marginTop: 8, color: '#475467', fontSize: 14, lineHeight: 20 },
  section: { marginTop: 14 },
  strong: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  meta: { marginTop: 5, color: '#667085', fontSize: 13, lineHeight: 18 },
  otp: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#F3EAFB' },
  otpLabel: { color: '#6C3AA8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  otpValue: { marginTop: 6, color: '#1F2937', fontSize: 28, fontWeight: '800', letterSpacing: 5 },
  otpUnavailable: { marginTop: 14, color: '#667085', fontSize: 13, lineHeight: 18 },
  action: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 8 },
  actionText: { color: '#6C3AA8', fontSize: 14, fontWeight: '700' },
});
