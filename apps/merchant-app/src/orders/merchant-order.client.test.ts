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
});
