import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerCheckoutQuoteClient } from './customer-checkout-quote.client';
import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';

export function DefaultCustomerCheckoutQuote({ addressId }: { readonly addressId: string | null }) {
  const apiSession = useCustomerApiSession();
  const quoteClient = useMemo(
    () =>
      new HttpCustomerCheckoutQuoteClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );

  return <CustomerCheckoutQuoteScreen addressId={addressId} quoteClient={quoteClient} />;
}
