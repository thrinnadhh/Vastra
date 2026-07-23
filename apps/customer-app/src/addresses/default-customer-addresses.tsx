import { useMemo } from 'react';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerAddressAdapter } from './api-customer-address.adapter';
import { CustomerAddressesScreen } from './customer-addresses.screen';

export function DefaultCustomerAddresses({
  mode = 'MANAGE',
  selectedAddressId = null,
  onSelectedAddressChange,
  onInvalidateQuote,
  onSecurityFailure,
}: {
  readonly mode?: 'MANAGE' | 'CHECKOUT';
  readonly selectedAddressId?: string | null;
  readonly onSelectedAddressChange?: (addressId: string | null) => void;
  readonly onInvalidateQuote?: () => void;
  readonly onSecurityFailure?: () => void;
}) {
  const apiClient = useCustomerApiClient();
  const addressPort = useMemo(() => new ApiCustomerAddressAdapter(apiClient), [apiClient]);

  return (
    <CustomerAddressesScreen
      addressPort={addressPort}
      mode={mode}
      selectedAddressId={selectedAddressId}
      {...(onSelectedAddressChange === undefined ? {} : { onSelectedAddressChange })}
      {...(onInvalidateQuote === undefined ? {} : { onInvalidateQuote })}
      {...(onSecurityFailure === undefined ? {} : { onSecurityFailure })}
    />
  );
}
