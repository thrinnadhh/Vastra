import {
  HttpMerchantOrderClient,
  parseMerchantOrderDetail,
  parseMerchantOrderPage,
} from './merchant-order.client';
import { MerchantOrderError } from './merchant-order.types';

const IDS = {
  order: '10000000-0000-4000-8000-000000000001',
  shop: '20000000-0000-4000-8000-000000000001',
  customer: '30000000-0000-4000-8000-000000000001',
  alert: '40000000-0000-4000-8000-000000000001',
  item: '50000000-0000-4000-8000-000000000001',
  product: '60000000-0000-4000-8000-000000000001',
  variant: '70000000-0000-4000-8000-000000000001',
  cart: '80000000-0000-4000-8000-000000000001',
  quote: '90000000-0000-4000-8000-000000000001',
  history: '1',
};

const totals = {
  subtotalPaise: 120000,
  productDiscountPaise: 0,
  couponDiscountPaise: 0,
  deliveryFeePaise: 4000,
  platformFeePaise: 500,
  taxPaise: 0,
  totalPaise: 124500,
};

const summary = {
  id: IDS.order,
  orderNumber: 'VAS-1001',
  shop: { id: IDS.shop, name: 'Ananya Fashions', slug: 'ananya-fashions' },
  customerName: 'Asha',
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  itemCount: 1,
  previewImageObjectKey: null,
  totals,
  alert: {
    id: IDS.alert,
    status: 'SENT',
    attemptCount: 1,
    firstSentAt: '2026-07-17T01:00:00.000Z',
    lastSentAt: '2026-07-17T01:00:00.000Z',
    acknowledgedAt: null,
    expiresAt: '2026-07-17T01:15:00.000Z',
    soundName: 'new_order',
    failureReason: null,
    createdAt: '2026-07-17T01:00:00.000Z',
  },
  estimatedDeliveryAt: '2026-07-17T02:00:00.000Z',
  placedAt: '2026-07-17T01:00:00.000Z',
  createdAt: '2026-07-17T01:00:00.000Z',
};

const detail = {
  ...summary,
  cartId: IDS.cart,
  quoteId: IDS.quote,
  address: {
    id: IDS.customer,
    label: 'Home',
    recipientName: 'Asha',
    phoneNumber: '9000000000',
    line1: '12 Temple Road',
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
      id: IDS.item,
      productId: IDS.product,
      variantId: IDS.variant,
      productName: 'Blue Kurta',
      sku: 'KURTA-M-BLUE',
      colourName: 'Blue',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 1,
      unitMrpPaise: 120000,
      unitSellingPricePaise: 120000,
      discountPaise: 0,
      totalPaise: 120000,
    },
  ],
  customerNote: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  history: [
    {
      id: IDS.history,
      previousStatus: null,
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-17T01:00:00.000Z',
    },
  ],
  acceptedAt: null,
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  updatedAt: '2026-07-17T01:00:00.000Z',
};

describe('merchant order HTTP client', () => {
  it('parses list and detail envelopes without reconstructing backend state', () => {
    expect(
      parseMerchantOrderPage({
        success: true,
        data: { orders: [summary], nextCursor: '20' },
        meta: { requestId: null },
      }),
    ).toMatchObject({
      nextCursor: '20',
      orders: [{ orderNumber: 'VAS-1001', status: 'WAITING_FOR_MERCHANT' }],
    });
    expect(
      parseMerchantOrderDetail({
        success: true,
        data: { order: detail },
        meta: { requestId: null },
      }),
    ).toMatchObject({
      orderNumber: 'VAS-1001',
      history: [{ newStatus: 'WAITING_FOR_MERCHANT' }],
    });
  });

  it('sends the restored bearer token and pagination', async () => {
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { orders: [summary], nextCursor: null },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('merchant-token'),
      fetchFunction,
    );
    await client.listOrders({ cursor: 'previous', limit: 10 });
    expect(fetchFunction).toHaveBeenCalledWith(
      'https://api.example.test/merchant/orders?cursor=previous&limit=10',
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer merchant-token' },
      },
    );
  });

  it('denies requests when the merchant session has no token', async () => {
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve(null),
      jest.fn(),
    );
    await expect(client.listOrders({})).rejects.toMatchObject({ kind: 'AUTHENTICATION' });
  });

  it('maps another shop denial and transport failures safely', async () => {
    const denied = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      () =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              success: false,
              error: { code: 'MERCHANT_ORDER_NOT_FOUND', retryable: false },
            }),
        }),
    );
    await expect(denied.getOrder(IDS.order)).rejects.toMatchObject({
      kind: 'NOT_FOUND',
      code: 'MERCHANT_ORDER_NOT_FOUND',
    });

    const offline = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      () => Promise.reject(new Error('offline')),
    );
    await expect(offline.listOrders({})).rejects.toEqual(
      new MerchantOrderError('TRANSPORT', null, true),
    );
  });

  it('rejects malformed authoritative data', () => {
    expect(() =>
      parseMerchantOrderPage({
        success: true,
        data: {
          orders: [{ ...summary, totals: { ...totals, totalPaise: 1.5 } }],
          nextCursor: null,
        },
      }),
    ).toThrow('Invalid merchant order response');
  });

  it('accepts with validated preparation time and no invented idempotency header', async () => {
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              order: {
                orderId: IDS.order,
                orderNumber: 'VAS-1001',
                status: 'MERCHANT_ACCEPTED',
                alertStatus: 'ACKNOWLEDGED',
                merchantPreparationMinutes: 45,
                acceptedAt: '2026-07-17T01:10:00.000Z',
                cancelledAt: null,
                cancellationReasonCode: null,
                cancellationNote: null,
                reservationsReleased: 0,
                replayed: false,
              },
            },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );
    await expect(client.acceptOrder(IDS.order, { preparationMinutes: 45 })).resolves.toMatchObject({
      status: 'MERCHANT_ACCEPTED',
      merchantPreparationMinutes: 45,
    });
    expect(fetchFunction).toHaveBeenCalledWith(
      `https://api.example.test/merchant/orders/${IDS.order}/accept`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preparationMinutes: 45 }),
      },
    );
  });

  it('rejects the complete order using the backend reasonCode contract', async () => {
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              order: {
                orderId: IDS.order,
                orderNumber: 'VAS-1001',
                status: 'CANCELLED',
                alertStatus: 'ACKNOWLEDGED',
                merchantPreparationMinutes: null,
                acceptedAt: null,
                cancelledAt: '2026-07-17T01:10:00.000Z',
                cancellationReasonCode: 'SHOP_BUSY',
                cancellationNote: 'Closing early',
                reservationsReleased: 1,
                replayed: false,
              },
            },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );
    await expect(
      client.rejectOrder(IDS.order, {
        reasonCode: 'SHOP_BUSY',
        orderItemId: null,
        note: 'Closing early',
      }),
    ).resolves.toMatchObject({ status: 'CANCELLED', reservationsReleased: 1 });
    expect(fetchFunction.mock.calls[0]?.[1].body).toBe(
      JSON.stringify({ reasonCode: 'SHOP_BUSY', orderItemId: null, note: 'Closing early' }),
    );
  });

  it('maps stale transitions so the UI can force an authoritative refresh', async () => {
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      () =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({
              success: false,
              error: { code: 'MERCHANT_ORDER_INVALID_STATE', retryable: false },
            }),
        }),
    );
    await expect(client.acceptOrder(IDS.order, { preparationMinutes: 30 })).rejects.toMatchObject({
      kind: 'INVALID_STATE',
      retryable: false,
    });
  });

  it('integrates start packing and durable packing-list reads', async () => {
    const responses: unknown[] = [
      {
        success: true,
        data: {
          order: {
            orderId: IDS.order,
            orderNumber: 'VAS-1001',
            status: 'PACKING',
            replayed: false,
          },
        },
        meta: { requestId: null },
      },
      {
        success: true,
        data: {
          packingList: {
            orderId: IDS.order,
            orderNumber: 'VAS-1001',
            status: 'PACKING',
            totalLines: 1,
            verifiedLines: 0,
            allVerified: false,
            items: [
              {
                orderItemId: IDS.item,
                productName: 'Blue Kurta',
                sku: 'KURTA-M-BLUE',
                colour: 'Blue',
                size: 'M',
                imageObjectKey: null,
                quantity: 1,
                fulfilmentStatus: 'PENDING',
                verification: null,
              },
            ],
          },
        },
        meta: { requestId: null },
      },
    ];
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(responses.shift()) }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );
    await expect(client.startPacking(IDS.order)).resolves.toMatchObject({ status: 'PACKING' });
    await expect(client.getPackingList(IDS.order)).resolves.toMatchObject({
      totalLines: 1,
      verifiedLines: 0,
      allVerified: false,
    });
    expect(fetchFunction.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [`https://api.example.test/merchant/orders/${IDS.order}/start-packing`, 'POST'],
      [`https://api.example.test/merchant/orders/${IDS.order}/packing-list`, 'GET'],
    ]);
  });

  it('records barcode mismatches as authoritative successful verification results', async () => {
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              verification: {
                orderId: IDS.order,
                orderItemId: IDS.item,
                fulfilmentStatus: 'PENDING',
                method: 'BARCODE',
                result: 'MISMATCH',
                scannedBarcode: 'WRONG-123',
                verified: false,
                verifiedAt: '2026-07-17T02:00:00.000Z',
                totalLines: 1,
                verifiedLines: 0,
                allVerified: false,
                replayed: false,
              },
            },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );
    await expect(
      client.verifyPackingItem(IDS.order, IDS.item, { method: 'BARCODE', barcode: 'WRONG-123' }),
    ).resolves.toMatchObject({ result: 'MISMATCH', verified: false });
    expect(fetchFunction.mock.calls[0]?.[1].body).toBe(
      JSON.stringify({ method: 'BARCODE', barcode: 'WRONG-123' }),
    );
  });

  it('sends one explicit ready-for-pickup idempotency key', async () => {
    const idempotencyKey = 'a0000000-0000-4000-8000-000000000001';
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              order: {
                orderId: IDS.order,
                orderNumber: 'VAS-1001',
                status: 'READY_FOR_PICKUP',
                readyAt: '2026-07-17T02:10:00.000Z',
                totalLines: 1,
                packedLines: 1,
                allPacked: true,
                replayed: false,
              },
            },
            meta: { requestId: null },
          }),
      }),
    );
    const client = new HttpMerchantOrderClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );
    await client.markReadyForPickup(IDS.order, idempotencyKey);
    expect(fetchFunction).toHaveBeenCalledWith(
      `https://api.example.test/merchant/orders/${IDS.order}/ready-for-pickup`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: '{}',
      },
    );
  });
});
