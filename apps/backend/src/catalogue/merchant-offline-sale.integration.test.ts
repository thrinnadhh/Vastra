import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantOfflineSaleController } from './merchant-offline-sale.controller';
import type { MerchantOfflineSaleGateway } from './merchant-offline-sale.gateway';
import { MerchantOfflineSaleService } from './merchant-offline-sale.service';
import { MERCHANT_OFFLINE_SALE_GATEWAY } from './merchant-offline-sale.tokens';
import type { MerchantOfflineSaleSnapshot } from './merchant-offline-sale.types';
import { MerchantShopContextService } from './merchant-shop-context.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '72000000-0000-4000-8000-000000000001';
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

function createSale(): MerchantOfflineSaleSnapshot {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    saleNumber: 'OS-70000000000040008000000000000001',
    idempotencyKey: IDEMPOTENCY_KEY,
    replayed: false,
    shopId: SHOP_ID,
    merchantId: ACTOR_ID,
    customerPhone: null,
    subtotalPaise: 100000,
    discountPaise: 0,
    taxPaise: 0,
    totalPaise: 100000,
    paymentMethod: 'CASH',
    status: 'COMPLETED',
    recordedBy: ACTOR_ID,
    createdAt: '2026-07-14T00:00:00.000Z',
    items: [
      {
        id: '71000000-0000-4000-8000-000000000001',
        variantId: VARIANT_ID,
        quantity: 1,
        unitPricePaise: 100000,
        discountPaise: 0,
        totalPaise: 100000,
        identificationMethod: 'MANUAL_SEARCH',
        movementId: '51',
        balance: {
          persisted: true,
          stockOnHand: 4,
          reservedQuantity: 0,
          damagedQuantity: 0,
          availableQuantity: 4,
          reorderLevel: 1,
          version: 3,
          lastCountedAt: null,
          updatedAt: '2026-07-14T00:00:00.000Z',
        },
      },
    ],
  };
}

class IntegrationShopService {
  public requireOwnedShop(): Promise<{ readonly id: string }> {
    return Promise.resolve({ id: SHOP_ID });
  }
}

class IntegrationOfflineSaleGateway implements MerchantOfflineSaleGateway {
  public createOfflineSale(): Promise<MerchantOfflineSaleSnapshot> {
    return Promise.resolve(createSale());
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

describe('merchant offline sale integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantOfflineSaleController],
      providers: [
        MerchantOfflineSaleService,
        {
          provide: MerchantShopContextService,
          useValue: new IntegrationShopService(),
        },
        {
          provide: MERCHANT_OFFLINE_SALE_GATEWAY,
          useValue: new IntegrationOfflineSaleGateway(),
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

  it('creates a completed offline sale', async () => {
    const response = await request(httpServer)
      .post('/merchant/offline-sales')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        shopId: SHOP_ID,
        paymentMethod: 'CASH',
        items: [
          {
            variantId: VARIANT_ID,
            quantity: 1,
            unitPricePaise: 100000,
            discountPaise: 0,
            identificationMethod: 'MANUAL_SEARCH',
          },
        ],
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const sale = requireRecord(readData(body)['sale'], 'sale');
    expect(sale['status']).toBe('COMPLETED');
    expect(sale['totalPaise']).toBe(100000);
  });

  it('rejects a missing idempotency key', async () => {
    const response = await request(httpServer)
      .post('/merchant/offline-sales')
      .send({
        shopId: SHOP_ID,
        paymentMethod: 'CASH',
        items: [
          {
            variantId: VARIANT_ID,
            quantity: 1,
            unitPricePaise: 100000,
            identificationMethod: 'MANUAL_SEARCH',
          },
        ],
      });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects duplicate variants in one sale', async () => {
    const item = {
      variantId: VARIANT_ID,
      quantity: 1,
      unitPricePaise: 100000,
      identificationMethod: 'MANUAL_SEARCH',
    };

    const response = await request(httpServer)
      .post('/merchant/offline-sales')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        shopId: SHOP_ID,
        paymentMethod: 'CASH',
        items: [item, item],
      });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
