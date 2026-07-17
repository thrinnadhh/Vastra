import { useMemo, useState } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerCheckoutQuoteClient } from './customer-checkout-quote.client';
import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import { HttpCustomerOrderPlacementClient } from '../orders/customer-order-placement.client';
import { CustomerOrderConfirmationScreen } from '../orders/customer-order-confirmation.screen';
import { DefaultCustomerOrderDetail } from '../orders/default-customer-order-detail';
import type { PlacedCustomerCodOrder } from '../orders/customer-order.types';

export function DefaultCustomerCheckoutQuote({
  addressId,
  onViewOrder = () => undefined,
  onContinueShopping,
}: {
  readonly addressId: string | null;
  readonly onViewOrder?: (orderId: string) => void;
  readonly onContinueShopping?: () => void;
}) {
  const apiSession = useCustomerApiSession();
  const [placedOrder, setPlacedOrder] = useState<PlacedCustomerCodOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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

  if (selectedOrderId !== null) {
    return (
      <DefaultCustomerOrderDetail
        onBack={() => {
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
      />
    );
  }

  if (placedOrder !== null) {
    return (
      <CustomerOrderConfirmationScreen
        onContinueShopping={() => {
          setPlacedOrder(null);
          onContinueShopping?.();
        }}
        onViewOrder={(orderId) => {
          setSelectedOrderId(orderId);
          onViewOrder(orderId);
        }}
        order={placedOrder}
      />
    );
  }

  return (
    <CustomerCheckoutQuoteScreen
      addressId={addressId}
      onOrderPlaced={setPlacedOrder}
      orderClient={orderClient}
      quoteClient={quoteClient}
    />
  );
}
