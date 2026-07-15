import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from '../auth/account-types.decorator';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { OPERATIONAL_READINESS_METADATA } from '../auth/operational-readiness.decorator';
import { MerchantOrderPackingController } from './merchant-order-packing.controller';
import type { MerchantOrderPackingGateway } from './merchant-order-packing.gateway';
import { MerchantOrderPackingService } from './merchant-order-packing.service';
import { MERCHANT_ORDER_PACKING_GATEWAY } from './merchant-order-packing.tokens';
import type {
  MerchantOrderItemVerificationInput,
  MerchantOrderItemVerificationResultData,
  MerchantOrderPackingList,
  MerchantOrderStartPackingResult,
} from './merchant-order-packing.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '30000000-0000-4000-8000-000000000001';
const context = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: Object.freeze({}),
} as unknown as AuthenticatedRequestContext;

class IntegrationGateway implements MerchantOrderPackingGateway {
  public startPacking(): Promise<MerchantOrderStartPackingResult> {
    return Promise.resolve({
      orderId: ORDER_ID,
      orderNumber: 'VAS-PACK-HTTP',
      status: 'PACKING',
      replayed: false,
    });
  }

  public getPackingList(): Promise<MerchantOrderPackingList> {
    return Promise.resolve({
      orderId: ORDER_ID,
      orderNumber: 'VAS-PACK-HTTP',
      status: 'PACKING',
      totalLines: 1,
      verifiedLines: 0,
      allVerified: false,
      items: [
        {
          orderItemId: ITEM_ID,
          productName: 'HTTP Kurta',
          sku: 'HTTP-KURTA-M',
          colour: 'Blue',
          size: 'M',
          imageObjectKey: null,
          quantity: 1,
          fulfilmentStatus: 'PENDING',
          verification: null,
        },
      ],
    });
  }

  public verifyItem(
    _actorId: string,
    _orderId: string,
    _orderItemId: string,
    input: MerchantOrderItemVerificationInput,
  ): Promise<MerchantOrderItemVerificationResultData> {
    void _actorId;
    void _orderId;
    void _orderItemId;
    return Promise.resolve({
      orderId: ORDER_ID,
      orderItemId: ITEM_ID,
      fulfilmentStatus: 'VERIFIED',
      method: input.method,
      result: 'MATCH',
      scannedBarcode: input.method === 'BARCODE' ? input.barcode : null,
      verified: true,
      verifiedAt: '2026-07-16T03:30:00.000Z',
      totalLines: 1,
      verifiedLines: 1,
      allVerified: true,
      replayed: false,
    });
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!isHttpServer(server)) throw new TypeError('Expected Node HTTP server');
  return server;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected response object');
  }
  return value as Record<string, unknown>;
}

function readData(value: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(value)['data']);
}

describe('merchant order packing integration contract', () => {
  let app: INestApplication | undefined;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MerchantOrderPackingController],
      providers: [
        MerchantOrderPackingService,
        { provide: MERCHANT_ORDER_PACKING_GATEWAY, useClass: IntegrationGateway },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((incoming: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
      void response;
      incoming.authContext = context;
      next();
    });
    await app.init();
    server = requireHttpServer(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('exposes three distinct merchant packing operations', async () => {
    const start = await request(server).post(`/merchant/orders/${ORDER_ID}/start-packing`).send({});
    const list = await request(server).get(`/merchant/orders/${ORDER_ID}/packing-list`);
    const verify = await request(server)
      .post(`/merchant/orders/${ORDER_ID}/items/${ITEM_ID}/verify`)
      .send({ method: 'MANUAL' });

    expect(start.status).toBe(200);
    expect(list.status).toBe(200);
    expect(verify.status).toBe(200);
    expect(requireRecord(readData(start.body)['order'])['status']).toBe('PACKING');
    expect(requireRecord(readData(list.body)['packingList'])['totalLines']).toBe(1);
    expect(requireRecord(readData(verify.body)['verification'])['verified']).toBe(true);
  });

  it('keeps the controller merchant-only and operational-readiness protected', () => {
    expect(
      Reflect.getMetadata(ALLOWED_ACCOUNT_TYPES_METADATA, MerchantOrderPackingController),
    ).toStrictEqual(['MERCHANT']);
    expect(
      Reflect.getMetadata(OPERATIONAL_READINESS_METADATA, MerchantOrderPackingController),
    ).toBe(true);
  });

  it('rejects invalid item identifiers before the gateway', async () => {
    const response = await request(server)
      .post(`/merchant/orders/${ORDER_ID}/items/not-a-uuid/verify`)
      .send({ method: 'MANUAL' });
    expect(response.status).toBe(400);
  });
});
