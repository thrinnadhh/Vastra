import { useMemo, useState } from 'react';

import { MerchantAlertDiagnosticsScreen } from '../alerts/merchant-alert-diagnostics.screen';
import {
  MerchantAlertRuntimeProvider,
  useMerchantAlertRuntime,
} from '../alerts/merchant-alert-notification.runtime';
import { HttpMerchantOrderAlertClient } from '../alerts/merchant-order-alert.client';
import { MerchantUrgentAlertModal } from '../alerts/merchant-urgent-alert.modal';
import { useMerchantApiSession } from '../auth/merchant-api-session';
import { MerchantReadinessGate } from '../readiness/merchant-readiness-gate';
import { HttpMerchantOrderClient } from './merchant-order.client';
import { MerchantOrderQueueScreen } from './merchant-order.screen';

function MerchantOrdersWithAlertRuntime(): React.JSX.Element {
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
      <MerchantReadinessGate
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

export function DefaultMerchantOrders(): React.JSX.Element {
  const session = useMerchantApiSession();
  return (
    <MerchantAlertRuntimeProvider session={session}>
      <MerchantOrdersWithAlertRuntime />
    </MerchantAlertRuntimeProvider>
  );
}
