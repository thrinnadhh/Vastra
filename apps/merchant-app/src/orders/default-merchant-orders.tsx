import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MerchantAlertDiagnosticsScreen } from '../alerts/merchant-alert-diagnostics.screen';
import {
  MerchantAlertRuntimeProvider,
  useMerchantAlertRuntime,
} from '../alerts/merchant-alert-notification.runtime';
import { HttpMerchantOrderAlertClient } from '../alerts/merchant-order-alert.client';
import { MerchantUrgentAlertModal } from '../alerts/merchant-urgent-alert.modal';
import { useMerchantApiSession } from '../auth/merchant-api-session';
import { HttpMerchantOrderClient } from './merchant-order.client';
import { MerchantOrderQueueScreen } from './merchant-order.screen';

function MerchantAlertSetupGate({ onOpenDiagnostics }: { readonly onOpenDiagnostics: () => void }) {
  const runtime = useMerchantAlertRuntime();
  const checking = runtime.setupState === 'CHECKING';

  return (
    <View accessibilityLabel="Merchant new-order alert setup required" style={styles.gate}>
      {checking ? <ActivityIndicator accessibilityLabel="Checking merchant alert setup" /> : null}
      <Text accessibilityRole="header" style={styles.gateTitle}>
        New-order alerts must be ready
      </Text>
      <Text style={styles.gateCopy}>
        Vastra keeps order handling blocked until notification permission, the urgent Android
        channel, a native FCM token, and backend device registration are verified.
      </Text>
      {runtime.diagnostics.failureReason === null ? null : (
        <Text accessibilityLiveRegion="assertive" style={styles.gateFailure}>
          {runtime.diagnostics.failureReason}
        </Text>
      )}
      <Pressable
        accessibilityLabel="Open merchant alert diagnostics"
        accessibilityRole="button"
        onPress={onOpenDiagnostics}
        style={styles.gatePrimary}
      >
        <Text style={styles.gatePrimaryText}>Open alert setup</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Retry merchant alert setup"
        accessibilityRole="button"
        disabled={checking}
        onPress={() => void runtime.refreshSetup()}
        style={[styles.gateSecondary, checking ? styles.disabled : null]}
      >
        <Text style={styles.gateSecondaryText}>{checking ? 'Checking…' : 'Retry setup'}</Text>
      </Pressable>
    </View>
  );
}

function MerchantOrdersWithAlertRuntime() {
  const session = useMerchantApiSession();
  const runtime = useMerchantAlertRuntime();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [requestedOrderId, setRequestedOrderId] = useState<string | null>(null);
  const orderClient = useMemo(
    () => new HttpMerchantOrderClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const alertClient = useMemo(() => new HttpMerchantOrderAlertClient(session), [session]);

  if (showDiagnostics) {
    return (
      <MerchantAlertDiagnosticsScreen
        onBack={() => {
          setShowDiagnostics(false);
        }}
      />
    );
  }

  if (runtime.setupState !== 'READY') {
    return (
      <MerchantAlertSetupGate
        onOpenDiagnostics={() => {
          setShowDiagnostics(true);
        }}
      />
    );
  }

  return (
    <>
      <MerchantOrderQueueScreen
        decisionClient={orderClient}
        onOpenAlertDiagnostics={() => {
          setShowDiagnostics(true);
        }}
        onRequestedOrderHandled={() => {
          setRequestedOrderId(null);
        }}
        orderClient={orderClient}
        packingClient={orderClient}
        requestedOrderId={requestedOrderId}
      />
      <MerchantUrgentAlertModal
        alertClient={alertClient}
        onOpenOrder={(orderId) => {
          setRequestedOrderId(orderId);
        }}
        orderClient={orderClient}
      />
    </>
  );
}

export function DefaultMerchantOrders() {
  const session = useMerchantApiSession();
  return (
    <MerchantAlertRuntimeProvider session={session}>
      <MerchantOrdersWithAlertRuntime />
    </MerchantAlertRuntimeProvider>
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
  gateTitle: {
    marginTop: 14,
    color: '#241B16',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  gateCopy: {
    marginTop: 12,
    maxWidth: 460,
    color: '#665A52',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  gateFailure: {
    marginTop: 14,
    color: '#9E1C2F',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  gatePrimary: {
    marginTop: 22,
    minWidth: 220,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#8E3B46',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  gatePrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  gateSecondary: {
    marginTop: 12,
    minWidth: 220,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  gateSecondaryText: { color: '#8E3B46', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
