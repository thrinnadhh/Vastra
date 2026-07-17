import { HttpCustomerOrderReadClient } from './customer-order-read.client';

const SUMMARY = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-20260716-0001',
  shop: {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Order Shop',
    slug: 'order-shop',
  },
  status: 'PACKING',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  itemCount: 2,
  previewImageObjectKey: null,
  totals: {
    subtotalPaise: 52_000,
    productDiscountPaise: 2_000,
    couponDiscountPaise: 1_000,
    deliveryFeePaise: 4_000,
    platformFeePaise: 500,
    taxPaise: 0,
    totalPaise: 53_500,
  },
  estimatedDeliveryAt: null,
  placedAt: '2026-07-16T10:01:00.000Z',
  createdAt: '2026-07-16T10:01:00.000Z',
} as const;

describe('HttpCustomerOrderReadClient list', () => {
  it('reads an authenticated paginated order page', async () => {
    const fetchFunction = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { orders: [SUMMARY], nextCursor: 'opaque-next' },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      fetchFunction,
    );

    const page = await client.listOrders({ cursor: 'opaque-current', limit: 10 });

    expect(page.orders).toHaveLength(1);
    expect(page.orders[0]?.status).toBe('PACKING');
    expect(page.nextCursor).toBe('opaque-next');
    expect(fetchFunction).toHaveBeenCalledWith(
      'https://api.vastra.test/v1/orders?limit=10&cursor=opaque-current',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer session-token',
        },
      },
    );
  });

  it('rejects malformed summaries instead of presenting invented data', async () => {
    const client = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { orders: [{ ...SUMMARY, status: 'MADE_UP' }], nextCursor: null },
              meta: { requestId: null },
            }),
        }),
    );

    await expect(client.listOrders()).rejects.toMatchObject({ kind: 'MALFORMED_RESPONSE' });
  });

  it('maps offline failures and never omits authentication', async () => {
    const offlineClient = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () => Promise.reject(new TypeError('offline')),
    );
    await expect(offlineClient.listOrders()).rejects.toMatchObject({ kind: 'TRANSPORT' });

    const fetchFunction = jest.fn();
    const unauthenticatedClient = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve(null),
      fetchFunction,
    );
    await expect(unauthenticatedClient.listOrders()).rejects.toMatchObject({
      kind: 'AUTHENTICATION',
    });
    expect(fetchFunction).not.toHaveBeenCalled();
  });
});
