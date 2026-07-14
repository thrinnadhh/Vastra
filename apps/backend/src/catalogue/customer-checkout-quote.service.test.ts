import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerCheckoutQuoteGateway,
  CustomerCheckoutQuoteAddressNotFoundError,
  CustomerCheckoutQuoteCartNotFoundError,
  CustomerCheckoutQuoteDataInvalidError,
  CustomerCheckoutQuoteGatewayUnavailableError,
  CustomerCheckoutQuoteInsufficientInventoryError,
  CustomerCheckoutQuoteMinimumOrderError,
  CustomerCheckoutQuoteOutsideServiceAreaError,
  CustomerCheckoutQuoteShopUnavailableError,
} from './customer-checkout-quote.gateway';
import { CustomerCheckoutQuoteService } from './customer-checkout-quote.service';
import type {
  CreateCustomerCheckoutQuoteInput,
  CustomerCheckoutQuoteSnapshot,
} from './customer-checkout-quote.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const SHOP_ID = '50000000-0000-4000-8000-000000000001';
const ITEM_ID = '60000000-0000-4000-8000-000000000001';
const VARIANT_ID = '70000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '80000000-0000-4000-8000-000000000001';
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

function createQuote(): CustomerCheckoutQuoteSnapshot {
  return {
    id: QUOTE_ID,
    cartId: CART_ID,
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
      id: SHOP_ID,
      name: 'Quote Shop',
      slug: 'quote-shop',
      minimumOrderPaise: 50000,
      averagePreparationMinutes: 20,
      distanceMeters: 500,
      serviceRadiusMeters: 5000,
    },
    items: [
      {
        cartItemId: ITEM_ID,
        variantId: VARIANT_ID,
        productId: PRODUCT_ID,
        productName: 'Quote Kurta',
        sku: 'QUOTE-KURTA-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        quantity: 2,
        previousUnitPricePaise: 50000,
        unitPricePaise: 60000,
        priceChanged: true,
        availableQuantity: 5,
        inventoryVersion: 2,
        lineTotalPaise: 120000,
      },
    ],
    totals: {
      subtotalPaise: 120000,
      productDiscountPaise: 0,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 0,
      taxPaise: 0,
      totalPaise: 120000,
    },
    estimatedPreparationMinutes: 20,
    estimatedTravelMinutes: 15,
    estimatedDeliveryAt: '2026-07-15T21:35:00.000Z',
    expiresAt: '2026-07-15T21:05:00.000Z',
    createdAt: '2026-07-15T21:00:00.000Z',
  };
}

class StubGateway implements CustomerCheckoutQuoteGateway {
  public quote = createQuote();
  public error: Error | null = null;
  public actorId: string | null = null;
  public input: CreateCustomerCheckoutQuoteInput | null = null;

  public createQuote(
    actorId: string,
    input: CreateCustomerCheckoutQuoteInput,
  ): Promise<CustomerCheckoutQuoteSnapshot> {
    this.actorId = actorId;
    this.input = input;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.quote);
  }
}

function readCode(error: HttpException): string {
  const response: unknown = error.getResponse();
  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
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

const gatewayErrorCases: readonly (readonly [Error, number, string])[] = [
  [new CustomerCheckoutQuoteCartNotFoundError(), 404, 'CART_NOT_FOUND'],
  [new CustomerCheckoutQuoteAddressNotFoundError(), 404, 'ADDRESS_NOT_FOUND'],
  [new CustomerCheckoutQuoteShopUnavailableError(), 409, 'SHOP_UNAVAILABLE'],
  [new CustomerCheckoutQuoteOutsideServiceAreaError(), 409, 'OUTSIDE_SERVICE_AREA'],
  [new CustomerCheckoutQuoteMinimumOrderError(), 409, 'MINIMUM_ORDER_NOT_MET'],
  [new CustomerCheckoutQuoteInsufficientInventoryError(), 409, 'INSUFFICIENT_INVENTORY'],
  [new CustomerCheckoutQuoteGatewayUnavailableError(), 503, 'EXTERNAL_SERVICE_UNAVAILABLE'],
  [new CustomerCheckoutQuoteDataInvalidError(), 500, 'CATALOGUE_STATE_INVALID'],
];

describe('CustomerCheckoutQuoteService', () => {
  let gateway: StubGateway;
  let service: CustomerCheckoutQuoteService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerCheckoutQuoteService(gateway);
  });

  it('creates a live checkout quote for the authenticated customer', async () => {
    const response = await service.createQuote(context, {
      addressId: ADDRESS_ID.toUpperCase(),
    });

    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.input).toStrictEqual({ addressId: ADDRESS_ID });
    expect(response.data.quote.id).toBe(QUOTE_ID);
    expect(response.data.quote.totals.totalPaise).toBe(120000);
  });

  it.each([
    [null],
    [{}],
    [{ addressId: 'not-a-uuid' }],
    [{ addressId: ADDRESS_ID, unknown: true }],
  ])('rejects invalid quote payloads', async (body) => {
    const error = await captureHttpException(service.createQuote(context, body));

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.input).toBeNull();
  });

  it.each(gatewayErrorCases)(
    'maps checkout quote gateway errors',
    async (gatewayError, status, code) => {
      gateway.error = gatewayError;

      const error = await captureHttpException(
        service.createQuote(context, { addressId: ADDRESS_ID }),
      );

      expect(error.getStatus()).toBe(status);
      expect(readCode(error)).toBe(code);
    },
  );
});
