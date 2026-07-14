import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerCartController } from './customer-cart.controller';
import type { CustomerCartGateway } from './customer-cart.gateway';
import { CustomerCartService } from './customer-cart.service';
import { CUSTOMER_CART_GATEWAY } from './customer-cart.tokens';
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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createCart(quantity = 2): CustomerCartSnapshot {
  const unitPricePaise = 75000;

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
        quantity,
        unitPricePaise,
        currentUnitPricePaise: unitPricePaise,
        priceChanged: false,
        availableQuantity: 5,
        isAvailable: true,
        lineTotalPaise: quantity * unitPricePaise,
        currentLineTotalPaise: quantity * unitPricePaise,
        addedAt: '2026-07-15T19:00:00.000Z',
        updatedAt: '2026-07-15T19:00:00.000Z',
      },
    ],
    itemCount: quantity,
    subtotalPaise: quantity * unitPricePaise,
    currentSubtotalPaise: quantity * unitPricePaise,
    hasPriceChanges: false,
    hasUnavailableItems: false,
    createdAt: '2026-07-15T19:00:00.000Z',
    updatedAt: '2026-07-15T19:00:00.000Z',
  };
}

class IntegrationGateway implements CustomerCartGateway {
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
    return Promise.resolve(createCart());
  }

  public setItem(
    actorId: string,
    input: SetCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    this.setActorId = actorId;
    this.setInput = input;
    return Promise.resolve(createCart(input.quantity));
  }

  public updateItem(
    actorId: string,
    cartItemId: string,
    input: UpdateCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    this.updateCall = { actorId, cartItemId, input };
    return Promise.resolve(createCart(input.quantity));
  }

  public removeItem(actorId: string, cartItemId: string): Promise<CustomerCartSnapshot | null> {
    this.removeCall = { actorId, cartItemId };
    return Promise.resolve(null);
  }

  public clearCart(actorId: string): Promise<CustomerCartSnapshot | null> {
    this.clearActorId = actorId;
    return Promise.resolve(null);
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readData(body: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(body, 'response')['data'], 'response data');
}

function readCart(body: unknown): Record<string, unknown> | null {
  const cart = readData(body)['cart'];

  if (cart === null) {
    return null;
  }

  return requireRecord(cart, 'cart');
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('customer one-shop cart integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [CustomerCartController],
      providers: [
        CustomerCartService,
        {
          provide: CUSTOMER_CART_GATEWAY,
          useValue: gateway,
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
        incomingRequest.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('reads the active cart', async () => {
    const response = await request(httpServer).get('/customer/cart');

    expect(response.status).toBe(200);
    expect(readCart(response.body)?.['id']).toBe(CART_ID);
  });

  it('sets a final item quantity and replacement decision', async () => {
    const response = await request(httpServer).post('/customer/cart/items').send({
      variantId: VARIANT_ID,
      quantity: 3,
      replaceExistingCart: true,
    });

    expect(response.status).toBe(200);
    expect(readCart(response.body)?.['itemCount']).toBe(3);
    expect(gateway.setActorId).toBe(ACTOR_ID);
    expect(gateway.setInput).toStrictEqual({
      variantId: VARIANT_ID,
      quantity: 3,
      replaceExistingCart: true,
    });
  });

  it('updates one cart item quantity', async () => {
    const response = await request(httpServer)
      .patch(`/customer/cart/items/${ITEM_ID}`)
      .send({ quantity: 4 });

    expect(response.status).toBe(200);
    expect(readCart(response.body)?.['itemCount']).toBe(4);
    expect(gateway.updateCall).toStrictEqual({
      actorId: ACTOR_ID,
      cartItemId: ITEM_ID,
      input: { quantity: 4 },
    });
  });

  it('removes a cart item and returns the remaining cart state', async () => {
    const response = await request(httpServer).delete(`/customer/cart/items/${ITEM_ID}`);

    expect(response.status).toBe(200);
    expect(readCart(response.body)).toBeNull();
    expect(gateway.removeCall).toStrictEqual({
      actorId: ACTOR_ID,
      cartItemId: ITEM_ID,
    });
  });

  it('clears the active cart idempotently', async () => {
    const response = await request(httpServer).delete('/customer/cart');

    expect(response.status).toBe(200);
    expect(readCart(response.body)).toBeNull();
    expect(gateway.clearActorId).toBe(ACTOR_ID);
  });

  it('rejects malformed cart input before calling the gateway', async () => {
    gateway.setActorId = null;
    gateway.setInput = null;

    const response = await request(httpServer).post('/customer/cart/items').send({
      variantId: VARIANT_ID,
      quantity: 0,
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
    expect(gateway.setActorId).toBeNull();
    expect(gateway.setInput).toBeNull();
  });
});
