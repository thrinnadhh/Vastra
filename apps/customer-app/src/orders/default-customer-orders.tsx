import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerOrderReadClient } from './customer-order-read.client';
import { CustomerOrdersScreen } from './customer-orders.screen';

export function DefaultCustomerOrders({
  onSelectOrder,
}: {
  readonly onSelectOrder: (orderId: string) => void;
}) {
  const apiSession = useCustomerApiSession();
  const ordersClient = useMemo(
    () => new HttpCustomerOrderReadClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );

  return <CustomerOrdersScreen onSelectOrder={onSelectOrder} ordersClient={ordersClient} />;
}
