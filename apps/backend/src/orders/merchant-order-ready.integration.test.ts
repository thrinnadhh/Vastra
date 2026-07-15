import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from '../auth/account-types.decorator';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { OPERATIONAL_READINESS_METADATA } from '../auth/operational-readiness.decorator';
import { MerchantOrderReadyController } from './merchant-order-ready.controller';
import type { MerchantOrderReadyGateway } from './merchant-order-ready.gateway';
import { MerchantOrderReadyService } from './merchant-order-ready.service';
import { MERCHANT_ORDER_READY_GATEWAY } from './merchant-order-ready.tokens';
import type { MerchantOrderReadyResult } from './merchant-order-ready.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';
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

class IntegrationGateway implements MerchantOrderReadyGateway {
  public static lastCall: readonly string[] | null = null;

  public markReady(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<MerchantOrderReadyResult> {
    IntegrationGateway.lastCall = [actorId, orderId, idempotencyKey];
    return Promise.resolve({
      orderId,
      orderNumber: 'VAS-READY-HTTP',
      status: 'READY_FOR_PICKUP',
      readyAt: '2026-07-16T04:30:00.000Z',
      totalLines: 1,
      packedLines: 1,
      allPacked: true,
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

describe('merchant ready-for-pickup integration contract', () => {
  let app: INestApplication | undefined;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MerchantOrderReadyController],
      providers: [
        MerchantOrderReadyService,
        { provide: MERCHANT_ORDER_READY_GATEWAY, useClass: IntegrationGateway },
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

  it('marks the order ready and passes the authenticated actor and idempotency key', async () => {
    const response = await request(server)
      .post(`/merchant/orders/${ORDER_ID}/ready-for-pickup`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { order: { status: 'READY_FOR_PICKUP', allPacked: true } },
    });
    expect(IntegrationGateway.lastCall).toStrictEqual([ACTOR_ID, ORDER_ID, IDEMPOTENCY_KEY]);
  });

  it('rejects an invalid order UUID and a missing idempotency key', async () => {
    const invalid = await request(server)
      .post('/merchant/orders/not-a-uuid/ready-for-pickup')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({});
    const missing = await request(server)
      .post(`/merchant/orders/${ORDER_ID}/ready-for-pickup`)
      .send({});
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
  });

  it('keeps the controller merchant-only and operational-readiness protected', () => {
    expect(
      Reflect.getMetadata(ALLOWED_ACCOUNT_TYPES_METADATA, MerchantOrderReadyController),
    ).toStrictEqual(['MERCHANT']);
    expect(Reflect.getMetadata(OPERATIONAL_READINESS_METADATA, MerchantOrderReadyController)).toBe(
      true,
    );
  });

  it.each([
    `/merchant/orders/${ORDER_ID}/start-packing`,
    `/merchant/orders/${ORDER_ID}/packing-list`,
    `/merchant/orders/${ORDER_ID}/items/40000000-0000-4000-8000-000000000001/verify`,
    `/merchant/orders/${ORDER_ID}/accept`,
    `/merchant/orders/${ORDER_ID}/reject`,
  ])('does not alias the ready command to %s', async (path) => {
    const response = await request(server).post(path).set('Idempotency-Key', IDEMPOTENCY_KEY);
    expect(response.status).toBe(404);
  });
});
