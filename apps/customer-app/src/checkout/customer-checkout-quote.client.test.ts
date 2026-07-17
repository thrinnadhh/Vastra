import { HttpCustomerCheckoutQuoteClient } from './customer-checkout-quote.client';
import { CustomerCheckoutQuoteError } from './customer-checkout-quote.types';

const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';

const SUCCESS_ENVELOPE = {
  success: true,
  data: {
    quote: {
      id: '40000000-0000-4000-8000-000000000001',
      cartId: '30000000-0000-4000-8000-000000000001',
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
      shop: {
        id: '50000000-0000-4000-8000-000000000001',
        name: 'Quote Shop',
        slug: 'quote-shop',
        minimumOrderPaise: 0,
        averagePreparationMinutes: 20,
        distanceMeters: 500,
        serviceRadiusMeters: 5000,
      },
      items: [
        {
          cartItemId: '60000000-0000-4000-8000-000000000001',
          variantId: '70000000-0000-4000-8000-000000000001',
          productId: '80000000-0000-4000-8000-000000000001',
          productName: 'Quote Kurta',
          sku: 'QUOTE-KURTA-M',
          colourName: 'Blue',
          sizeLabel: 'M',
          quantity: 2,
          previousUnitPricePaise: 26_000,
          unitPricePaise: 25_000,
          priceChanged: true,
          availableQuantity: 3,
          inventoryVersion: 1,
          lineTotalPaise: 50_000,
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
      estimatedPreparationMinutes: 20,
      estimatedTravelMinutes: 15,
      estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
      expiresAt: '2026-07-16T10:05:00.000Z',
      createdAt: '2026-07-16T10:00:00.000Z',
    },
  },
  meta: { requestId: null },
} as const;

function errorEnvelope(code: string, retryable = false) {
  return {
    success: false,
    error: {
      code,
      message: 'Safe test message',
      details: null,
      retryable,
    },
    requestId: null,
  };
}

describe('HttpCustomerCheckoutQuoteClient', () => {
  it('posts the exact body to /checkout/quote with bearer authentication and maps the envelope', async () => {
    const fetchFunction = jest.fn<
      Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
      [string, RequestInit]
    >(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SUCCESS_ENVELOPE),
      }),
    );
    const client = new HttpCustomerCheckoutQuoteClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      fetchFunction,
    );

    const quote = await client.createQuote({ addressId: ADDRESS_ID });

    expect(quote.id).toBe('40000000-0000-4000-8000-000000000001');
    expect(quote.items[0]).toStrictEqual({
      cartItemId: '60000000-0000-4000-8000-000000000001',
      variantId: '70000000-0000-4000-8000-000000000001',
      productId: '80000000-0000-4000-8000-000000000001',
      productName: 'Quote Kurta',
      sku: 'QUOTE-KURTA-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      quantity: 2,
      previousUnitPricePaise: 26_000,
      unitPricePaise: 25_000,
      priceChanged: true,
      availableQuantity: 3,
      inventoryVersion: 1,
      lineTotalPaise: 50_000,
    });
    expect(quote.totals.totalPaise).toBe(53_500);
    expect(fetchFunction).toHaveBeenCalledWith('https://api.vastra.test/v1/checkout/quote', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addressId: ADDRESS_ID }),
    });
    expect(fetchFunction).toHaveBeenCalledTimes(1);
    expect(fetchFunction.mock.calls[0]?.[0]).not.toContain('/orders');
  });

  it('rejects a malformed success response', async () => {
    const client = new HttpCustomerCheckoutQuoteClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { quote: { id: 'broken' } } }),
        }),
    );

    await expect(client.createQuote({ addressId: ADDRESS_ID })).rejects.toMatchObject({
      kind: 'MALFORMED_RESPONSE',
    });
  });

  it.each([
    ['INSUFFICIENT_INVENTORY', 'UNAVAILABLE_ITEM'],
    ['CART_PRICE_CHANGED', 'CHANGED_PRICE'],
    ['OUTSIDE_SERVICE_AREA', 'UNSERVICEABLE_ADDRESS'],
    ['CHECKOUT_QUOTE_EXPIRED', 'STALE_QUOTE'],
  ] as const)('maps backend error %s to %s', async (code, kind) => {
    const client = new HttpCustomerCheckoutQuoteClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve('session-token'),
      () =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve(errorEnvelope(code)),
        }),
    );

    await expect(client.createQuote({ addressId: ADDRESS_ID })).rejects.toMatchObject({
      kind,
      code,
    });
  });

  it('rejects before transport when no authenticated session is available', async () => {
    const fetchFunction = jest.fn<Promise<never>, [string, RequestInit]>();
    const client = new HttpCustomerCheckoutQuoteClient(
      'https://api.vastra.test/v1',
      () => Promise.resolve(null),
      fetchFunction,
    );

    await expect(client.createQuote({ addressId: ADDRESS_ID })).rejects.toBeInstanceOf(
      CustomerCheckoutQuoteError,
    );
    await expect(client.createQuote({ addressId: ADDRESS_ID })).rejects.toMatchObject({
      kind: 'AUTHENTICATION',
    });
    expect(fetchFunction).not.toHaveBeenCalled();
  });
});
