import type { ApiClient } from '@vastra/api-client';

import { ApiMerchantOrderHandoverAdapter } from './merchant-order-handover.client';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const TASK_ID = '20000000-0000-4000-8000-000000000001';

function client(request: jest.Mock): ApiClient {
  return { request } as unknown as ApiClient;
}

describe('ApiMerchantOrderHandoverAdapter', () => {
  it('uses the generated delivery operation and validates order identity', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          delivery: {
            orderId: ORDER_ID,
            deliveryTaskId: TASK_ID,
            orderNumber: 'VAS-1',
            orderStatus: 'CAPTAIN_ASSIGNED',
            taskStatus: 'ASSIGNED',
            captainAssigned: true,
            captainAtStore: false,
            pickedUpAt: null,
            updatedAt: '2026-07-24T12:00:00.000Z',
          },
        },
        meta: { requestId: null },
      },
    });
    const adapter = new ApiMerchantOrderHandoverAdapter(client(request));

    await expect(adapter.getDelivery(ORDER_ID)).resolves.toMatchObject({
      orderId: ORDER_ID,
      taskStatus: 'ASSIGNED',
      captainAssigned: true,
    });
    expect(request).toHaveBeenCalledWith('getMerchantOrderDelivery', {
      path: { orderId: ORDER_ID },
    });
  });

  it('reads pickup code only through the generated secret operation', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          secret: {
            orderId: ORDER_ID,
            deliveryTaskId: TASK_ID,
            kind: 'PICKUP_CODE',
            secret: '123456',
            issuedAt: '2026-07-24T12:00:00.000Z',
            expiresAt: '2026-07-24T12:10:00.000Z',
          },
        },
        meta: { requestId: null },
      },
    });
    const adapter = new ApiMerchantOrderHandoverAdapter(client(request));

    await expect(adapter.getPickupCode(ORDER_ID)).resolves.toMatchObject({
      orderId: ORDER_ID,
      deliveryTaskId: TASK_ID,
      secret: '123456',
    });
    expect(request).toHaveBeenCalledWith('getMerchantPickupCode', {
      path: { orderId: ORDER_ID },
    });
  });

  it('rejects a mismatched secret without exposing it through another order', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          secret: {
            orderId: '30000000-0000-4000-8000-000000000001',
            deliveryTaskId: TASK_ID,
            kind: 'PICKUP_CODE',
            secret: '000000',
            issuedAt: '2026-07-24T12:00:00.000Z',
            expiresAt: '2026-07-24T12:10:00.000Z',
          },
        },
        meta: { requestId: null },
      },
    });
    const adapter = new ApiMerchantOrderHandoverAdapter(client(request));

    await expect(adapter.getPickupCode(ORDER_ID)).rejects.toMatchObject({
      kind: 'MALFORMED_RESPONSE',
    });
  });
});
