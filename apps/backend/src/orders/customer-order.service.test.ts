import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerOrderGateway,
  CustomerOrderCartNotFoundError,
  CustomerOrderDataInvalidError,
  CustomerOrderGatewayUnavailableError,
  CustomerOrderIdempotencyConflictError,
  CustomerOrderInsufficientStockError,
  CustomerOrderQuoteExpiredError,
  CustomerOrderQuoteNotFoundError,
  CustomerOrderQuoteStaleError,
} from './customer-order.gateway';
import { CustomerOrderService } from './customer-order.service';
import type { CustomerCodOrderSnapshot, PlaceCustomerCodOrderInput } from './customer-order.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CART_ID = '20000000-0000-4000-8000-000000000001';
const QUOTE_ID = '30000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '40000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '50000000-0000-4000-8000-000000000001';
const ORDER_ID = '60000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createOrder(): CustomerCodOrderSnapshot {
  return {
    id: ORDER_ID,
    orderNumber: 'VAS-60000000000040008000000000000001',
    cartId: CART_ID,
    quoteId: QUOTE_ID,
    shop: {
      id: '70000000-0000-4000-8000-000000000001',
      name: 'Order Shop',
      slug: 'order-shop',
    },
    address: {
      id: ADDRESS_ID,
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
    status: 'WAITING_FOR_MERCHANT',
    paymentStatus: 'COD_PENDING',
    paymentMethod: 'COD',
    fulfilmentType: 'DELIVERY',
    items: [
      {
        id: '80000000-0000-4000-8000-000000000001',
        productId: '90000000-0000-4000-8000-000000000001',
        variantId: 'a0000000-0000-4000-8000-000000000001',
        productName: 'Order Kurta',
        sku: 'ORDER-KURTA-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        imageObjectKey: null,
        quantity: 1,
        unitMrpPaise: 60000,
        unitSellingPricePaise: 50000,
        discountPaise: 0,
        totalPaise: 50000,
      },
    ],
    totals: {
      subtotalPaise: 50000,
      productDiscountPaise: 0,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 0,
      taxPaise: 0,
      totalPaise: 50000,
    },
    estimatedDeliveryAt: '2026-07-15T23:40:00.000Z',
    customerNote: 'Call on arrival',
    placedAt: '2026-07-15T23:00:00.000Z',
    replayed: false,
  };
}

class StubGateway implements CustomerOrderGateway {
  public actorId: string | null = null;
  public input: PlaceCustomerCodOrderInput | null = null;
  public error: Error | null = null;
  public order = createOrder();

  public placeCodOrder(
    actorId: string,
    input: PlaceCustomerCodOrderInput,
  ): Promise<CustomerCodOrderSnapshot> {
    this.actorId = actorId;
    this.input = input;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.order);
  }
}

function readCode(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response !== 'object' || Array.isArray(response)) {
    throw new TypeError('Expected structured error response');
  }

  const apiError = (response as Record<string, unknown>)['error'];
  if (typeof apiError !== 'object' || apiError === null || Array.isArray(apiError)) {
    throw new TypeError('Expected structured API error');
  }

  const code = (apiError as Record<string, unknown>)['code'];
  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code');
  }

  return code;
}

async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected promise to reject');
}

const mappedErrors: readonly (readonly [Error, number, string])[] = [
  [new CustomerOrderCartNotFoundError(), 404, 'CART_NOT_FOUND'],
  [new CustomerOrderQuoteNotFoundError(), 404, 'CHECKOUT_QUOTE_NOT_FOUND'],
  [new CustomerOrderQuoteExpiredError(), 409, 'CHECKOUT_QUOTE_EXPIRED'],
  [new CustomerOrderQuoteStaleError(), 409, 'INVENTORY_CONFLICT'],
  [new CustomerOrderIdempotencyConflictError(), 409, 'IDEMPOTENCY_CONFLICT'],
  [new CustomerOrderInsufficientStockError(), 409, 'INSUFFICIENT_STOCK'],
  [new CustomerOrderDataInvalidError(), 500, 'INTERNAL_ERROR'],
  [new CustomerOrderGatewayUnavailableError(), 503, 'EXTERNAL_SERVICE_UNAVAILABLE'],
];

describe('CustomerOrderService', () => {
  let gateway: StubGateway;
  let service: CustomerOrderService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerOrderService(gateway);
  });

  it('places a normalized COD order with an idempotency key', async () => {
    const response = await service.placeCodOrder(context, IDEMPOTENCY_KEY.toUpperCase(), {
      cartId: CART_ID.toUpperCase(),
      quoteId: QUOTE_ID,
      addressId: ADDRESS_ID,
      paymentMethod: 'COD',
      customerNote: '  Call on arrival  ',
    });

    expect(response.data.order.id).toBe(ORDER_ID);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.input).toStrictEqual({
      cartId: CART_ID,
      quoteId: QUOTE_ID,
      addressId: ADDRESS_ID,
      paymentMethod: 'COD',
      customerNote: 'Call on arrival',
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it('requires the idempotency header', async () => {
    const error = await captureHttpException(
      service.placeCodOrder(context, undefined, {
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'COD',
      }),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(gateway.input).toBeNull();
  });

  it.each([
    [{ cartId: CART_ID, quoteId: QUOTE_ID, addressId: ADDRESS_ID, paymentMethod: 'CARD' }],
    [{ cartId: 'invalid', quoteId: QUOTE_ID, addressId: ADDRESS_ID, paymentMethod: 'COD' }],
    [
      {
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'COD',
        unknown: true,
      },
    ],
  ])('rejects invalid order payloads', async (body) => {
    const error = await captureHttpException(service.placeCodOrder(context, IDEMPOTENCY_KEY, body));

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.input).toBeNull();
  });

  it.each(mappedErrors)('maps order gateway errors', async (gatewayError, status, code) => {
    gateway.error = gatewayError;

    const error = await captureHttpException(
      service.placeCodOrder(context, IDEMPOTENCY_KEY, {
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'COD',
      }),
    );

    expect(error.getStatus()).toBe(status);
    expect(readCode(error)).toBe(code);
  });
});
