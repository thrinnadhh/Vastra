import { useMemo, useState } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerOrderReadClient } from './customer-order-read.client';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import { CustomerOrdersScreen } from './customer-orders.screen';

export function DefaultCustomerOrders({
  onSelectOrder,
}: {
  readonly onSelectOrder?: (orderId: string) => void;
}) {
  const apiSession = useCustomerApiSession();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const ordersClient = useMemo(
    () => new HttpCustomerOrderReadClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );

  if (selectedOrderId !== null) {
    return (
      <CustomerOrderDetailScreen
        onBack={() => {
          setSelectedOrderId(null);
        }}
        orderClient={ordersClient}
        orderId={selectedOrderId}
      />
    );
  }

  return (
    <CustomerOrdersScreen
      onSelectOrder={(orderId) => {
        setSelectedOrderId(orderId);
        onSelectOrder?.(orderId);
      }}
      ordersClient={ordersClient}
    />
  );
}
