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

const DETAIL = {
  ...SUMMARY,
  cartId: '30000000-0000-4000-8000-000000000001',
  quoteId: '40000000-0000-4000-8000-000000000001',
  address: {
    id: '20000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '9000000001',
    line1: 'Order Street',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    latitude: 13.6288,
    longitude: 79.4192,
  },
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      productId: '70000000-0000-4000-8000-000000000001',
      variantId: '80000000-0000-4000-8000-000000000001',
      productName: 'Order Kurta',
      sku: 'ORDER-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 2,
      unitMrpPaise: 26_000,
      unitSellingPricePaise: 25_000,
      discountPaise: 2_000,
      totalPaise: 50_000,
    },
  ],
  customerNote: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  history: [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-16T10:01:00.000Z',
    },
    {
      id: '2',
      previousStatus: 'WAITING_FOR_MERCHANT',
      newStatus: 'PACKING',
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: 'Packing began',
      createdAt: '2026-07-16T10:10:00.000Z',
    },
  ],
  acceptedAt: '2026-07-16T10:05:00.000Z',
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  updatedAt: '2026-07-16T10:10:00.000Z',
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

describe('HttpCustomerOrderReadClient detail', () => {
  it('reads one owned order with the backend history unchanged', async () => {
    const fetchFunction = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { order: DETAIL },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      fetchFunction,
    );

    const order = await client.getOrder(DETAIL.id);

    expect(order.history.map((entry) => entry.newStatus)).toStrictEqual([
      'WAITING_FOR_MERCHANT',
      'PACKING',
    ]);
    expect(fetchFunction).toHaveBeenCalledWith(`https://api.vastra.test/v1/orders/${DETAIL.id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
      },
    });
  });

  it('preserves cross-customer denial without disclosing an order', async () => {
    const client = new HttpCustomerOrderReadClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Forbidden',
                details: null,
                retryable: false,
              },
              requestId: null,
            }),
        }),
    );

    await expect(client.getOrder(DETAIL.id)).rejects.toMatchObject({
      kind: 'FORBIDDEN',
      code: 'FORBIDDEN',
    });
  });
});
