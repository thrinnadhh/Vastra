import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerCartGateway,
  CustomerCartDataInvalidError,
  CustomerCartGatewayUnavailableError,
  CustomerCartInsufficientInventoryError,
  CustomerCartItemNotFoundError,
  CustomerCartShopConflictError,
  CustomerCartVariantNotFoundError,
} from './customer-cart.gateway';
import { CustomerCartService } from './customer-cart.service';
import type {
  CustomerCartSnapshot,
  SetCustomerCartItemInput,
  UpdateCustomerCartItemInput,
} from './customer-cart.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CART_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '60000000-0000-4000-8000-000000000001';
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

function createCart(): CustomerCartSnapshot {
  return {
    id: CART_ID,
    shop: {
      id: SHOP_ID,
      name: 'Cart Shop',
      slug: 'cart-shop',
      logoObjectKey: null,
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
    },
    items: [
      {
        id: ITEM_ID,
        variantId: VARIANT_ID,
        productId: PRODUCT_ID,
        productName: 'Cart Kurta',
        productSlug: 'cart-kurta',
        sku: 'CART-KURTA-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        imageObjectKey: null,
        quantity: 2,
        unitPricePaise: 75000,
        currentUnitPricePaise: 75000,
        priceChanged: false,
        availableQuantity: 5,
        isAvailable: true,
        lineTotalPaise: 150000,
        currentLineTotalPaise: 150000,
        addedAt: '2026-07-15T19:00:00.000Z',
        updatedAt: '2026-07-15T19:00:00.000Z',
      },
    ],
    itemCount: 2,
    subtotalPaise: 150000,
    currentSubtotalPaise: 150000,
    hasPriceChanges: false,
    hasUnavailableItems: false,
    createdAt: '2026-07-15T19:00:00.000Z',
    updatedAt: '2026-07-15T19:00:00.000Z',
  };
}

class StubGateway implements CustomerCartGateway {
  public cart: CustomerCartSnapshot | null = createCart();
  public error: Error | null = null;
  public setActorId: string | null = null;
  public setInput: SetCustomerCartItemInput | null = null;
  public updateCall: {
    readonly actorId: string;
    readonly cartItemId: string;
    readonly input: UpdateCustomerCartItemInput;
  } | null = null;
  public removeCall: {
    readonly actorId: string;
    readonly cartItemId: string;
  } | null = null;
  public clearActorId: string | null = null;

  public getCart(_client: SupabaseClient): Promise<CustomerCartSnapshot | null> {
    void _client;
    return this.result();
  }

  public setItem(
    actorId: string,
    input: SetCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    this.setActorId = actorId;
    this.setInput = input;
    return this.result();
  }

  public updateItem(
    actorId: string,
    cartItemId: string,
    input: UpdateCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    this.updateCall = { actorId, cartItemId, input };
    return this.result();
  }

  public removeItem(actorId: string, cartItemId: string): Promise<CustomerCartSnapshot | null> {
    this.removeCall = { actorId, cartItemId };
    return this.result();
  }

  public clearCart(actorId: string): Promise<CustomerCartSnapshot | null> {
    this.clearActorId = actorId;
    return this.result();
  }

  private result(): Promise<CustomerCartSnapshot | null> {
    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.cart);
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

const invalidSetItemBodies: readonly (readonly [unknown])[] = [
  [null],
  [{ variantId: 'not-a-uuid', quantity: 1 }],
  [{ variantId: VARIANT_ID, quantity: 0 }],
  [{ variantId: VARIANT_ID, quantity: 21 }],
  [
    {
      variantId: VARIANT_ID,
      quantity: 1,
      replaceExistingCart: 'yes',
    },
  ],
  [
    {
      variantId: VARIANT_ID,
      quantity: 1,
      unknown: true,
    },
  ],
];

const gatewayErrorCases: readonly (readonly [Error, number, string])[] = [
  [new CustomerCartItemNotFoundError(), 404, 'CART_ITEM_NOT_FOUND'],
  [new CustomerCartVariantNotFoundError(), 404, 'VARIANT_NOT_FOUND'],
  [new CustomerCartShopConflictError(), 409, 'CART_SHOP_CONFLICT'],
  [new CustomerCartInsufficientInventoryError(), 409, 'INSUFFICIENT_INVENTORY'],
  [new CustomerCartGatewayUnavailableError(), 503, 'EXTERNAL_SERVICE_UNAVAILABLE'],
  [new CustomerCartDataInvalidError(), 500, 'CATALOGUE_STATE_INVALID'],
];

describe('CustomerCartService', () => {
  let gateway: StubGateway;
  let service: CustomerCartService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerCartService(gateway);
  });

  it('reads the current customer cart', async () => {
    const response = await service.getCart(context);

    expect(response.data.cart?.id).toBe(CART_ID);
    expect(response.data.cart?.itemCount).toBe(2);
  });

  it('sets a desired item quantity with replacement disabled by default', async () => {
    await service.setItem(context, {
      variantId: VARIANT_ID.toUpperCase(),
      quantity: 2,
    });

    expect(gateway.setActorId).toBe(ACTOR_ID);
    expect(gateway.setInput).toStrictEqual({
      variantId: VARIANT_ID,
      quantity: 2,
      replaceExistingCart: false,
    });
  });

  it('passes explicit cross-shop replacement confirmation', async () => {
    await service.setItem(context, {
      variantId: VARIANT_ID,
      quantity: 1,
      replaceExistingCart: true,
    });

    expect(gateway.setActorId).toBe(ACTOR_ID);
    expect(gateway.setInput?.replaceExistingCart).toBe(true);
  });

  it('updates an owned cart item quantity', async () => {
    await service.updateItem(context, ITEM_ID.toUpperCase(), { quantity: 3 });

    expect(gateway.updateCall).toStrictEqual({
      actorId: ACTOR_ID,
      cartItemId: ITEM_ID,
      input: { quantity: 3 },
    });
  });

  it('removes an owned cart item', async () => {
    await service.removeItem(context, ITEM_ID.toUpperCase());

    expect(gateway.removeCall).toStrictEqual({
      actorId: ACTOR_ID,
      cartItemId: ITEM_ID,
    });
  });

  it('clears the active cart', async () => {
    gateway.cart = null;

    const response = await service.clearCart(context);

    expect(gateway.clearActorId).toBe(ACTOR_ID);
    expect(response.data.cart).toBeNull();
  });

  it.each(invalidSetItemBodies)('rejects invalid set-item payloads', async (body) => {
    const error = await captureHttpException(service.setItem(context, body));

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.setInput).toBeNull();
  });

  it('rejects invalid item identifiers and update payloads', async () => {
    const invalidId = await captureHttpException(
      service.updateItem(context, 'invalid', { quantity: 1 }),
    );
    const invalidBody = await captureHttpException(
      service.updateItem(context, ITEM_ID, { quantity: 0 }),
    );

    expect(invalidId.getStatus()).toBe(400);
    expect(invalidBody.getStatus()).toBe(400);
    expect(gateway.updateCall).toBeNull();
  });

  it.each(gatewayErrorCases)('maps cart gateway errors', async (gatewayError, status, code) => {
    gateway.error = gatewayError;

    const error = await captureHttpException(service.getCart(context));

    expect(error.getStatus()).toBe(status);
    expect(readCode(error)).toBe(code);
  });
});
