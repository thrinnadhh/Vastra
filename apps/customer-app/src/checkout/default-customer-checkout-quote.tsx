import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useCustomerApiSession } from '../auth/customer-api-session';
import { HttpCustomerCheckoutQuoteClient } from './customer-checkout-quote.client';
import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import { HttpCustomerOrderPlacementClient } from '../orders/customer-order-placement.client';
import type { PlacedCustomerCodOrder } from '../orders/customer-order.types';

export function DefaultCustomerCheckoutQuote({ addressId }: { readonly addressId: string | null }) {
  const apiSession = useCustomerApiSession();
  const [placedOrder, setPlacedOrder] = useState<PlacedCustomerCodOrder | null>(null);
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

  if (placedOrder !== null) {
    return (
      <View accessible accessibilityLabel={`Order ${placedOrder.orderNumber} placed`}>
        <Text>Order placed</Text>
        <Text>{placedOrder.orderNumber}</Text>
      </View>
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
