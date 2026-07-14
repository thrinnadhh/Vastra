import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantOrderReadController } from './merchant-order-read.controller';
import type { MerchantOrderReadGateway } from './merchant-order-read.gateway';
import { MerchantOrderReadService } from './merchant-order-read.service';
import { MERCHANT_ORDER_READ_GATEWAY } from './merchant-order-read.tokens';
import type {
  MerchantOrderDetail,
  MerchantOrderListPage,
  MerchantOrderListQuery,
} from './merchant-order-read.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createDetail(): MerchantOrderDetail {
  return {
    id: ORDER_ID,
    orderNumber: 'VAS-INTEGRATION',
    cartId: null,
    quoteId: null,
    shop: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Integration Shop',
      slug: 'integration-shop',
    },
    address: {
      id: '40000000-0000-4000-8000-000000000001',
      label: 'Home',
      recipientName: 'Integration Customer',
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
        id: '50000000-0000-4000-8000-000000000001',
        productId: '60000000-0000-4000-8000-000000000001',
        variantId: '70000000-0000-4000-8000-000000000001',
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
    alert: {
      id: '80000000-0000-4000-8000-000000000001',
      status: 'PENDING',
      attemptCount: 0,
      firstSentAt: null,
      lastSentAt: null,
      acknowledgedAt: null,
      expiresAt: '2026-07-15T20:15:00.000Z',
      soundName: 'vastra_new_order',
      failureReason: null,
      createdAt: '2026-07-15T20:00:00.000Z',
    },
    estimatedDeliveryAt: '2026-07-15T21:00:00.000Z',
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
        createdAt: '2026-07-15T20:00:00.000Z',
      },
      {
        id: '2',
        previousStatus: 'PAYMENT_PENDING',
        newStatus: 'WAITING_FOR_MERCHANT',
        changedByRole: 'CUSTOMER',
        reasonCode: null,
        note: 'Customer placed a COD order',
        createdAt: '2026-07-15T20:00:00.000Z',
      },
    ],
    placedAt: '2026-07-15T20:00:00.000Z',
    acceptedAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-07-15T20:00:00.000Z',
    updatedAt: '2026-07-15T20:00:00.000Z',
  };
}

class IntegrationGateway implements MerchantOrderReadGateway {
  public actorId: string | null = null;
  public query: MerchantOrderListQuery | null = null;

  public listMerchantOrders(
    client: SupabaseClient,
    merchantId: string,
    query: MerchantOrderListQuery,
  ): Promise<MerchantOrderListPage> {
    void client;
    this.actorId = merchantId;
    this.query = query;
    const detail = createDetail();

    return Promise.resolve({
      orders: [
        {
          id: detail.id,
          orderNumber: detail.orderNumber,
          shop: detail.shop,
          customerName: detail.address.recipientName,
          status: detail.status,
          paymentStatus: detail.paymentStatus,
          fulfilmentType: detail.fulfilmentType,
          itemCount: detail.itemCount,
          previewImageObjectKey: null,
          totals: detail.totals,
          alert: detail.alert,
          estimatedDeliveryAt: detail.estimatedDeliveryAt,
          placedAt: detail.placedAt,
          createdAt: detail.createdAt,
        },
      ],
      nextOffset: null,
    });
  }

  public getMerchantOrder(
    client: SupabaseClient,
    merchantId: string,
    orderId: string,
  ): Promise<MerchantOrderDetail> {
    void client;
    this.actorId = merchantId;

    if (orderId !== ORDER_ID) {
      throw new TypeError('Unexpected order identifier');
    }

    return Promise.resolve(createDetail());
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

describe('merchant order read integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [MerchantOrderReadController],
      providers: [
        MerchantOrderReadService,
        {
          provide: MERCHANT_ORDER_READ_GATEWAY,
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

  it('lists merchant shop orders through GET /merchant/orders', async () => {
    const response = await request(httpServer).get('/merchant/orders?limit=10');

    expect(response.status).toBe(200);
    expect(readData(response.body)['orders']).toHaveLength(1);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.query).toStrictEqual({ offset: 0, limit: 10 });
  });

  it('gets merchant order detail through GET /merchant/orders/:orderId', async () => {
    const response = await request(httpServer).get(`/merchant/orders/${ORDER_ID}`);

    expect(response.status).toBe(200);
    const order = requireRecord(readData(response.body)['order'], 'order');
    expect(order['id']).toBe(ORDER_ID);
    expect(order['alert']).not.toBeNull();
  });

  it('rejects an invalid order identifier', async () => {
    const response = await request(httpServer).get('/merchant/orders/invalid');

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
