import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerOrderController } from './customer-order.controller';
import type { CustomerOrderGateway } from './customer-order.gateway';
import { CustomerOrderService } from './customer-order.service';
import { CUSTOMER_ORDER_GATEWAY } from './customer-order.tokens';
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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

class IntegrationGateway implements CustomerOrderGateway {
  public actorId: string | null = null;
  public input: PlaceCustomerCodOrderInput | null = null;

  public placeCodOrder(
    actorId: string,
    input: PlaceCustomerCodOrderInput,
  ): Promise<CustomerCodOrderSnapshot> {
    this.actorId = actorId;
    this.input = input;

    return Promise.resolve({
      id: ORDER_ID,
      orderNumber: 'VAS-60000000000040008000000000000001',
      cartId: input.cartId,
      quoteId: input.quoteId,
      shop: {
        id: '70000000-0000-4000-8000-000000000001',
        name: 'Order Shop',
        slug: 'order-shop',
      },
      address: {
        id: input.addressId,
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
      customerNote: input.customerNote,
      placedAt: '2026-07-15T23:00:00.000Z',
      replayed: false,
    });
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

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];
  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('customer COD order integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [CustomerOrderController],
      providers: [
        CustomerOrderService,
        {
          provide: CUSTOMER_ORDER_GATEWAY,
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

  it('places a COD order through POST /orders', async () => {
    const response = await request(httpServer)
      .post('/orders')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'COD',
        customerNote: 'Call on arrival',
      });

    expect(response.status).toBe(200);
    const order = requireRecord(readData(response.body)['order'], 'order');
    expect(order['id']).toBe(ORDER_ID);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.input?.idempotencyKey).toBe(IDEMPOTENCY_KEY);
  });

  it('rejects a missing Idempotency-Key', async () => {
    const response = await request(httpServer).post('/orders').send({
      cartId: CART_ID,
      quoteId: QUOTE_ID,
      addressId: ADDRESS_ID,
      paymentMethod: 'COD',
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects online payment methods in the COD slice', async () => {
    const response = await request(httpServer)
      .post('/orders')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        cartId: CART_ID,
        quoteId: QUOTE_ID,
        addressId: ADDRESS_ID,
        paymentMethod: 'UPI',
      });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
