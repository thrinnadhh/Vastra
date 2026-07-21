import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  adminKeys,
  asAccountId,
  asAuthorizationEpoch,
  captainKeys,
  customerKeys,
  invalidateAdminResourceChange,
  invalidateCaptainDeliveryChange,
  invalidateCustomerCartChange,
  invalidateMerchantOrderChange,
  merchantKeys,
  normalizeQueryFilters,
} from '../src/index';

describe('typed invalidation helpers', () => {
  const accountId = asAccountId('10000000-0000-4000-8000-000000000001');
  const filters = normalizeQueryFilters({ status: 'ACTIVE' });
  const shopId = '20000000-0000-4000-8000-000000000001';
  const resourceId = '30000000-0000-4000-8000-000000000001';

  it('invalidates cart projections and removes every checkout quote', async () => {
    const client = new QueryClient();
    client.setQueryData(customerKeys.cart(accountId), { id: 'cart' });
    client.setQueryData(customerKeys.checkoutQuote(accountId, 'quote-1'), { id: 'quote-1' });

    await invalidateCustomerCartChange(client, accountId);

    expect(client.getQueryState(customerKeys.cart(accountId))?.isInvalidated).toBe(true);
    expect(client.getQueryData(customerKeys.checkoutQuote(accountId, 'quote-1'))).toBeUndefined();
  });

  it('invalidates merchant order detail, queue, packing, and alert prefixes', async () => {
    const client = new QueryClient();
    const keys = [
      merchantKeys.order(accountId, shopId, resourceId),
      merchantKeys.orderQueue(accountId, shopId, filters),
      merchantKeys.packingList(accountId, shopId, resourceId),
      merchantKeys.alert(accountId, shopId, 'alert-1'),
    ];
    for (const key of keys) client.setQueryData(key, { ok: true });

    await invalidateMerchantOrderChange(client, accountId, shopId, resourceId);

    expect(keys.every((key) => client.getQueryState(key)?.isInvalidated === true)).toBe(true);
  });

  it('invalidates captain task ownership and availability projections', async () => {
    const client = new QueryClient();
    const keys = [
      captainKeys.offers(accountId),
      captainKeys.activeDelivery(accountId),
      captainKeys.delivery(accountId, resourceId),
      captainKeys.availability(accountId),
    ];
    for (const key of keys) client.setQueryData(key, { ok: true });

    await invalidateCaptainDeliveryChange(client, accountId, resourceId);

    expect(keys.every((key) => client.getQueryState(key)?.isInvalidated === true)).toBe(true);
  });

  it('invalidates admin detail, collection, dashboard, and audit under one auth epoch', async () => {
    const client = new QueryClient();
    const epoch = asAuthorizationEpoch('epoch-1');
    const keys = [
      adminKeys.detail(accountId, epoch, 'orders', resourceId),
      adminKeys.collection(accountId, epoch, 'orders', filters),
      adminKeys.dashboard(accountId, epoch),
      adminKeys.audit(accountId, epoch, filters),
    ];
    for (const key of keys) client.setQueryData(key, { ok: true });

    await invalidateAdminResourceChange(client, accountId, epoch, 'orders', resourceId);

    expect(keys.every((key) => client.getQueryState(key)?.isInvalidated === true)).toBe(true);
  });
});
