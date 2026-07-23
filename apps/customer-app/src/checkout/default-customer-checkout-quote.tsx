import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerOrderPlacementClient } from '../orders/customer-order-placement.client';
import { HttpCustomerCheckoutQuoteClient } from './customer-checkout-quote.client';
import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import type {
  CustomerCheckoutPlacementPhase,
  CustomerCheckoutQuoteIdentity,
} from './customer-checkout-transaction';

export function DefaultCustomerCheckoutQuote({
  addressId,
  idempotencyKey,
  onQuoteAccepted,
  onPlacementPhaseChange,
  onOrderConfirmed,
  onSecurityFailure,
}: {
  readonly addressId: string | null;
  readonly idempotencyKey?: string;
  readonly onQuoteAccepted?: (identity: CustomerCheckoutQuoteIdentity) => void;
  readonly onPlacementPhaseChange?: (phase: CustomerCheckoutPlacementPhase) => void;
  readonly onOrderConfirmed?: (orderId: string) => void;
  readonly onSecurityFailure?: () => void;
}) {
  const apiSession = useCustomerApiSession();
  const quoteClient = useMemo(
    () =>
      new HttpCustomerCheckoutQuoteClient(apiSession.apiBaseUrl, () => apiSession.getAccessToken()),
    [apiSession],
  );
  const orderClient = useMemo(
    () =>
      new HttpCustomerOrderPlacementClient(apiSession.apiBaseUrl, () =>
        apiSession.getAccessToken(),
      ),
    [apiSession],
  );

  return (
    <CustomerCheckoutQuoteScreen
      addressId={addressId}
      orderClient={orderClient}
      quoteClient={quoteClient}
      {...(idempotencyKey === undefined ? {} : { idempotencyKey })}
      {...(onQuoteAccepted === undefined ? {} : { onQuoteAccepted })}
      {...(onPlacementPhaseChange === undefined ? {} : { onPlacementPhaseChange })}
      {...(onOrderConfirmed === undefined ? {} : { onOrderConfirmed })}
      {...(onSecurityFailure === undefined ? {} : { onSecurityFailure })}
    />
  );
}
