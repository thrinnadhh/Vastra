import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerOrderReadController } from './customer-order-read.controller';
import {
  type CustomerOrderReadGateway,
  CustomerOrderReadNotFoundError,
} from './customer-order-read.gateway';
import { CustomerOrderReadService } from './customer-order-read.service';
import { CUSTOMER_ORDER_READ_GATEWAY } from './customer-order-read.tokens';
import type {
  CustomerOrderDetail,
  CustomerOrderListPage,
  CustomerOrderListQuery,
} from './customer-order-read.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const MISSING_ORDER_ID = '20000000-0000-4000-8000-000000000002';
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

const orderDetail: CustomerOrderDetail = {
  id: ORDER_ID,
  orderNumber: 'VST-READ-ORDER',
  cartId: '30000000-0000-4000-8000-000000000001',
  quoteId: '40000000-0000-4000-8000-000000000001',
  shop: {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Integration Shop',
    slug: 'integration-shop',
  },
  address: {
    id: '60000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '9000000001',
    line1: 'Integration Street',
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
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: '70000000-0000-4000-8000-000000000001',
      productId: '80000000-0000-4000-8000-000000000001',
      variantId: '90000000-0000-4000-8000-000000000001',
      productName: 'Integration Kurta',
      sku: 'INTEGRATION-KURTA-M',
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
  itemCount: 1,
  totals: {
    subtotalPaise: 50000,
    productDiscountPaise: 0,
    couponDiscountPaise: 0,
    deliveryFeePaise: 0,
    platformFeePaise: 0,
    taxPaise: 0,
    totalPaise: 50000,
  },
  estimatedDeliveryAt: '2026-07-15T12:45:00.000Z',
  customerNote: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  history: [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'PAYMENT_PENDING',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-15T12:00:00.000Z',
    },
  ],
  placedAt: '2026-07-15T12:00:01.000Z',
  acceptedAt: null,
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-15T12:00:00.000Z',
  updatedAt: '2026-07-15T12:00:01.000Z',
};

class IntegrationGateway implements CustomerOrderReadGateway {
  public actorId: string | null = null;
  public query: CustomerOrderListQuery | null = null;

  public listCustomerOrders(
    client: SupabaseClient,
    actorId: string,
    query: CustomerOrderListQuery,
  ): Promise<CustomerOrderListPage> {
    void client;
    this.actorId = actorId;
    this.query = query;

    return Promise.resolve({
      orders: [
        {
          id: orderDetail.id,
          orderNumber: orderDetail.orderNumber,
          shop: orderDetail.shop,
          status: orderDetail.status,
          paymentStatus: orderDetail.paymentStatus,
          fulfilmentType: orderDetail.fulfilmentType,
          itemCount: orderDetail.itemCount,
          previewImageObjectKey: null,
          totals: orderDetail.totals,
          estimatedDeliveryAt: orderDetail.estimatedDeliveryAt,
          placedAt: orderDetail.placedAt,
          createdAt: orderDetail.createdAt,
        },
      ],
      nextOffset: null,
    });
  }

  public getCustomerOrder(
    client: SupabaseClient,
    actorId: string,
    orderId: string,
  ): Promise<CustomerOrderDetail> {
    void client;
    this.actorId = actorId;

    if (orderId === MISSING_ORDER_ID) {
      return Promise.reject(new CustomerOrderReadNotFoundError());
    }

    return Promise.resolve(orderDetail);
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

describe('customer order reads integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [CustomerOrderReadController],
      providers: [
        CustomerOrderReadService,
        {
          provide: CUSTOMER_ORDER_READ_GATEWAY,
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

  it('lists authenticated customer orders through GET /orders', async () => {
    const response = await request(httpServer).get('/orders').query({ limit: '10' });

    expect(response.status).toBe(200);
    const orders = readData(response.body)['orders'];
    expect(Array.isArray(orders)).toBe(true);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.query).toStrictEqual({ offset: 0, limit: 10 });
  });

  it('gets one authenticated customer order through GET /orders/:orderId', async () => {
    const response = await request(httpServer).get(`/orders/${ORDER_ID}`);

    expect(response.status).toBe(200);
    const order = requireRecord(readData(response.body)['order'], 'order');
    expect(order['id']).toBe(ORDER_ID);
  });

  it('rejects an invalid order identifier', async () => {
    const response = await request(httpServer).get('/orders/invalid');

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });

  it('does not reveal an invisible order', async () => {
    const response = await request(httpServer).get(`/orders/${MISSING_ORDER_ID}`);

    expect(response.status).toBe(404);
    expect(readErrorCode(response.body)).toBe('ORDER_NOT_FOUND');
  });
});
