import { useMemo, useState } from 'react';

import { MerchantAlertDiagnosticsScreen } from '../alerts/merchant-alert-diagnostics.screen';
import {
  MerchantAlertRuntimeProvider,
  useMerchantAlertRuntime,
} from '../alerts/merchant-alert-notification.runtime';
import { HttpMerchantOrderAlertClient } from '../alerts/merchant-order-alert.client';
import { MerchantUrgentAlertModal } from '../alerts/merchant-urgent-alert.modal';
import { useMerchantApiClient } from '../api/use-merchant-api-client';
import { useMerchantApiSession } from '../auth/merchant-api-session';
import { MerchantReadinessGate } from '../readiness/merchant-readiness-gate';
import { DeduplicatingMerchantOrderReadPort } from './deduplicating-merchant-order-read.port';
import { HttpMerchantOrderClient } from './merchant-order.client';
import { ApiMerchantOrderHandoverAdapter } from './merchant-order-handover.client';
import { MerchantOrderQueueScreen } from './merchant-order.screen';

function MerchantOrdersWithAlertRuntime(): React.JSX.Element {
  const session = useMerchantApiSession();
  const apiClient = useMerchantApiClient();
  const runtime = useMerchantAlertRuntime();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [requestedOrderId, setRequestedOrderId] = useState<string | null>(null);
  const orderClient = useMemo(
    () => new HttpMerchantOrderClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const orderReadPort = useMemo(
    () => new DeduplicatingMerchantOrderReadPort(orderClient),
    [orderClient],
  );
  const handoverClient = useMemo(
    () => new ApiMerchantOrderHandoverAdapter(apiClient),
    [apiClient],
  );
  const alertClient = useMemo(() => new HttpMerchantOrderAlertClient(session), [session]);

  const expireSession = (): void => {
    void session.expireSession?.();
  };

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
        handoverClient={handoverClient}
        onOpenAlertDiagnostics={() => {
          setShowDiagnostics(true);
        }}
        onRequestedOrderHandled={() => {
          setRequestedOrderId(null);
        }}
        onSessionExpired={expireSession}
        orderClient={orderReadPort}
        packingClient={orderClient}
        requestedOrderId={requestedOrderId}
      />
      <MerchantUrgentAlertModal
        alertClient={alertClient}
        decisionClient={orderClient}
        onOpenOrder={(orderId) => {
          setRequestedOrderId(orderId);
        }}
        orderClient={orderReadPort}
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
