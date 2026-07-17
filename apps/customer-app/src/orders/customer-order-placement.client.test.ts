import { HttpCustomerOrderPlacementClient } from './customer-order-placement.client';

const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';

const ORDER_ENVELOPE = {
  success: true,
  data: {
    order: {
      id: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'VAS-20260716-0001',
      cartId: CART_ID,
      quoteId: QUOTE_ID,
      shop: {
        id: '50000000-0000-4000-8000-000000000001',
        name: 'Quote Shop',
        slug: 'quote-shop',
      },
      address: {
        id: ADDRESS_ID,
        label: 'Home',
        recipientName: 'Customer',
        phoneNumber: '9000000001',
        line1: 'Quote Street',
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
      status: 'WAITING_FOR_MERCHANT',
      paymentStatus: 'COD_PENDING',
      paymentMethod: 'COD',
      fulfilmentType: 'DELIVERY',
      items: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          productId: '70000000-0000-4000-8000-000000000001',
          variantId: '80000000-0000-4000-8000-000000000001',
          productName: 'Quote Kurta',
          sku: 'QUOTE-KURTA-M',
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
      totals: {
        subtotalPaise: 52_000,
        productDiscountPaise: 2_000,
        couponDiscountPaise: 1_000,
        deliveryFeePaise: 4_000,
        platformFeePaise: 500,
        taxPaise: 0,
        totalPaise: 53_500,
      },
      estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
      customerNote: null,
      placedAt: '2026-07-16T10:01:00.000Z',
      replayed: false,
    },
  },
  meta: { requestId: null },
} as const;

function errorEnvelope(code: string, retryable = false) {
  return {
    success: false,
    error: { code, message: 'Safe test message', details: null, retryable },
    requestId: null,
  };
}

describe('HttpCustomerOrderPlacementClient', () => {
  it('places only COD with bearer auth and the supplied stable idempotency key', async () => {
    const fetchFunction = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ORDER_ENVELOPE),
      }),
    );
    const client = new HttpCustomerOrderPlacementClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      fetchFunction,
    );

    const order = await client.placeCodOrder({
      cartId: CART_ID,
      quoteId: QUOTE_ID,
      addressId: ADDRESS_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(order.orderNumber).toBe('VAS-20260716-0001');
    expect(order.replayed).toBe(false);
    expect(fetchFunction).toHaveBeenCalledWith('https://api.vastra.test/v1/orders', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': IDEMPOTENCY_KEY,
      },
      body: JSON.stringify({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'COD',
      }),
    });
  });

  it.each([
    ['CHECKOUT_QUOTE_EXPIRED', 409, 'STALE_QUOTE'],
    ['CART_PRICE_CHANGED', 409, 'STALE_QUOTE'],
    ['INSUFFICIENT_INVENTORY', 409, 'STALE_QUOTE'],
    ['EXTERNAL_SERVICE_UNAVAILABLE', 503, 'TEMPORARILY_UNAVAILABLE'],
  ] as const)('maps %s to %s', async (code, status, kind) => {
    const client = new HttpCustomerOrderPlacementClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: false,
          status,
          json: () => Promise.resolve(errorEnvelope(code, status === 503)),
        }),
    );

    await expect(
      client.placeCodOrder({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({ kind, code });
  });

  it('does not make a request without an authenticated session', async () => {
    const fetchFunction = jest.fn();
    const client = new HttpCustomerOrderPlacementClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve(null),
      fetchFunction,
    );

    await expect(
      client.placeCodOrder({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({ kind: 'AUTHENTICATION' });
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it('rejects a malformed success envelope', async () => {
    const client = new HttpCustomerOrderPlacementClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { order: { id: 'bad' } } }),
        }),
    );

    await expect(
      client.placeCodOrder({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({ kind: 'MALFORMED_RESPONSE' });
  });
});
