import { useMemo } from 'react';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerCartAdapter } from './api-customer-cart.adapter';
import { CustomerCartScreen } from './customer-cart.screen';

export function DefaultCustomerCart({
  onCheckout,
  onSessionExpired,
}: {
  readonly onCheckout: () => void;
  readonly onSessionExpired?: () => void;
}) {
  const apiClient = useCustomerApiClient();
  const cartClient = useMemo(() => new ApiCustomerCartAdapter(apiClient), [apiClient]);

  return (
    <CustomerCartScreen
      cartClient={cartClient}
      onCheckout={onCheckout}
      {...(onSessionExpired === undefined ? {} : { onSessionExpired })}
    />
  );
}
