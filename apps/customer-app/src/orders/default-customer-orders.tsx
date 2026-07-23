import { useMemo, useState } from 'react';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerOrderAdapter } from './api-customer-order.adapter';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import { CustomerOrdersScreen } from './customer-orders.screen';

export function DefaultCustomerOrders({
  initialOrderId = null,
  onBackFromInitialOrder,
  onSelectOrder,
}: {
  readonly initialOrderId?: string | null;
  readonly onBackFromInitialOrder?: () => void;
  readonly onSelectOrder?: (orderId: string) => void;
}) {
  const apiClient = useCustomerApiClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId);
  const ordersClient = useMemo(() => new ApiCustomerOrderAdapter(apiClient), [apiClient]);

  if (selectedOrderId !== null) {
    return (
      <CustomerOrderDetailScreen
        onBack={() => {
          if (initialOrderId !== null && selectedOrderId === initialOrderId) {
            onBackFromInitialOrder?.();
            return;
          }
          setSelectedOrderId(null);
        }}
        orderClient={ordersClient}
        orderId={selectedOrderId}
        trackingClient={ordersClient}
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
