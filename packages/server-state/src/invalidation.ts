import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { adminKeys, captainKeys, customerKeys, merchantKeys } from './keys';
import type { AccountId, AuthorizationEpoch } from './types';

async function invalidatePrefixes(
  client: QueryClient,
  prefixes: readonly QueryKey[],
): Promise<void> {
  await Promise.all(
    prefixes.map(async (queryKey) => {
      await client.invalidateQueries({ queryKey, exact: false, refetchType: 'active' });
    }),
  );
}

export async function invalidateCustomerCartChange(
  client: QueryClient,
  accountId: AccountId,
): Promise<void> {
  client.removeQueries({ queryKey: customerKeys.checkoutQuotes(accountId), exact: false });
  await invalidatePrefixes(client, [customerKeys.cart(accountId)]);
}

export async function invalidateMerchantOrderChange(
  client: QueryClient,
  accountId: AccountId,
  shopId: string,
  orderId: string,
): Promise<void> {
  await invalidatePrefixes(client, [
    merchantKeys.order(accountId, shopId, orderId),
    merchantKeys.orderQueues(accountId, shopId),
    merchantKeys.packingList(accountId, shopId, orderId),
    merchantKeys.alerts(accountId, shopId),
  ]);
}

export async function invalidateCaptainDeliveryChange(
  client: QueryClient,
  accountId: AccountId,
  taskId: string,
): Promise<void> {
  await invalidatePrefixes(client, [
    captainKeys.offers(accountId),
    captainKeys.activeDelivery(accountId),
    captainKeys.delivery(accountId, taskId),
    captainKeys.availability(accountId),
  ]);
}

export async function invalidateAdminResourceChange(
  client: QueryClient,
  accountId: AccountId,
  authorizationEpoch: AuthorizationEpoch,
  resource: string,
  resourceId: string,
): Promise<void> {
  await invalidatePrefixes(client, [
    adminKeys.detail(accountId, authorizationEpoch, resource, resourceId),
    adminKeys.collections(accountId, authorizationEpoch, resource),
    adminKeys.dashboard(accountId, authorizationEpoch),
    adminKeys.audits(accountId, authorizationEpoch),
  ]);
}
