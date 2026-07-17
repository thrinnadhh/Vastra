import { useMemo } from 'react';

import { useMerchantApiSession } from '../auth/merchant-api-session';
import { HttpMerchantOrderClient } from './merchant-order.client';
import { MerchantOrderQueueScreen } from './merchant-order.screen';

export function DefaultMerchantOrders() {
  const session = useMerchantApiSession();
  const orderClient = useMemo(
    () => new HttpMerchantOrderClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  return <MerchantOrderQueueScreen orderClient={orderClient} />;
}
