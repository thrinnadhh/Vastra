import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import { HttpCustomerOrderReadClient } from './customer-order-read.client';

export function DefaultCustomerOrderDetail({ orderId }: { readonly orderId: string }) {
  const apiSession = useCustomerApiSession();
  const orderClient = useMemo(
    () => new HttpCustomerOrderReadClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );

  return <CustomerOrderDetailScreen orderClient={orderClient} orderId={orderId} />;
}
