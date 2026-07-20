import { describe, expect, it } from 'vitest';

import {
  AccountPartitionedQueryClient,
  asAccountId,
  asAuthorizationEpoch,
  createVastraQueryClient,
  customerKeys,
} from '../src/index';

describe('account-partitioned cache lifecycle', () => {
  const firstAccount = asAccountId('10000000-0000-4000-8000-000000000001');
  const secondAccount = asAccountId('20000000-0000-4000-8000-000000000002');

  it('reuses a client only for the same resolved partition', async () => {
    const lifecycle = new AccountPartitionedQueryClient();
    const first = await lifecycle.activate({ actor: 'customer', accountId: firstAccount });
    const same = await lifecycle.activate({ actor: 'customer', accountId: firstAccount });

    expect(same).toBe(first);
  });

  it('cancels and clears cache data on account, actor, or authorization change', async () => {
    const lifecycle = new AccountPartitionedQueryClient(createVastraQueryClient);
    const first = await lifecycle.activate({ actor: 'customer', accountId: firstAccount });
    first.setQueryData(customerKeys.cart(firstAccount), { id: 'private-cart' });

    const second = await lifecycle.activate({ actor: 'captain', accountId: secondAccount });
    expect(second).not.toBe(first);
    expect(first.getQueryCache().getAll()).toHaveLength(0);

    await lifecycle.activate({
      actor: 'admin',
      accountId: secondAccount,
      authorizationEpoch: asAuthorizationEpoch('epoch-1'),
    });
    const adminNext = await lifecycle.activate({
      actor: 'admin',
      accountId: secondAccount,
      authorizationEpoch: asAuthorizationEpoch('epoch-2'),
    });
    expect(lifecycle.currentClient()).toBe(adminNext);
  });

  it('clears the active cache for sign-out, role mismatch, suspension, or downgrade', async () => {
    const lifecycle = new AccountPartitionedQueryClient();
    const client = await lifecycle.activate({ actor: 'customer', accountId: firstAccount });
    client.setQueryData(customerKeys.cart(firstAccount), { id: 'private-cart' });

    await lifecycle.clear();

    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(lifecycle.currentClient()).toBeNull();
    expect(lifecycle.currentPartition()).toBeNull();
  });
});
