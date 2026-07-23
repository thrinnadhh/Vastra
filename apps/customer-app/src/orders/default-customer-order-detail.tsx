import { useMemo } from 'react';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerOrderAdapter } from './api-customer-order.adapter';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';

export function DefaultCustomerOrderDetail({
  orderId,
  onBack,
}: {
  readonly orderId: string;
  readonly onBack?: () => void;
}) {
  const apiClient = useCustomerApiClient();
  const orderClient = useMemo(() => new ApiCustomerOrderAdapter(apiClient), [apiClient]);

  return (
    <CustomerOrderDetailScreen
      {...(onBack === undefined ? {} : { onBack })}
      orderClient={orderClient}
      orderId={orderId}
      trackingClient={orderClient}
    />
  );
}
