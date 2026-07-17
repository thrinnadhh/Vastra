import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import { HttpCustomerOrderReadClient } from './customer-order-read.client';

export function DefaultCustomerOrderDetail({
  orderId,
  onBack,
}: {
  readonly orderId: string;
  readonly onBack?: () => void;
}) {
  const apiSession = useCustomerApiSession();
  const orderClient = useMemo(
    () => new HttpCustomerOrderReadClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );

  return (
    <CustomerOrderDetailScreen
      {...(onBack === undefined ? {} : { onBack })}
      orderClient={orderClient}
      orderId={orderId}
    />
  );
}
