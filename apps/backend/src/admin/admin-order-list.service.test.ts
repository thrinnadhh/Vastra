import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminOrderListGateway } from './admin-order-list.gateway';
import { AdminOrderListService } from './admin-order-list.service';
import type {
  AdminOperationalOrderPage,
  AdminOperationalOrderQuery,
} from './admin-order-list.types';

const CONTEXT = {} as AuthenticatedRequestContext;
const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';

class GatewayStub implements AdminOrderListGateway {
  public query: AdminOperationalOrderQuery | null = null;
  public page: AdminOperationalOrderPage = {
    items: [],
    nextCursor: { updatedAt: '2026-07-26T00:00:00.000Z', id: ORDER_ID },
  };

  public list(query: AdminOperationalOrderQuery): Promise<AdminOperationalOrderPage> {
    this.query = query;
    return Promise.resolve(this.page);
  }
}

describe('AdminOrderListService', () => {
  it('validates filters and returns an opaque keyset cursor', async () => {
    const gateway = new GatewayStub();
    const service = new AdminOrderListService(gateway);
    const response = await service.list(
      CONTEXT,
      'STUCK',
      'CAPTAIN_SEARCHING',
      SHOP_ID,
      undefined,
      '50',
    );

    expect(gateway.query).toStrictEqual({
      queue: 'STUCK',
      status: 'CAPTAIN_SEARCHING',
      shopId: SHOP_ID,
      cursor: null,
      limit: 50,
    });
    expect(response.data.nextCursor).toBe(
      Buffer.from(
        JSON.stringify({ updatedAt: '2026-07-26T00:00:00.000Z', id: ORDER_ID }),
        'utf8',
      ).toString('base64url'),
    );
  });

  it('rejects unknown operational queues', async () => {
    const service = new AdminOrderListService(new GatewayStub());
    await expect(
      service.list(CONTEXT, 'FAKE', undefined, undefined, undefined, undefined),
    ).rejects.toMatchObject({ status: 400 });
  });
});
