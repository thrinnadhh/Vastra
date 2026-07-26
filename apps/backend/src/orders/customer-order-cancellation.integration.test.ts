import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from '../auth/account-types.decorator';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { OPERATIONAL_READINESS_METADATA } from '../auth/operational-readiness.decorator';
import { CustomerOrderCancellationController } from './customer-order-cancellation.controller';
import type { CustomerOrderCancellationGateway } from './customer-order-cancellation.gateway';
import { CustomerOrderCancellationService } from './customer-order-cancellation.service';
import { CUSTOMER_ORDER_CANCELLATION_GATEWAY } from './customer-order-cancellation.tokens';
import type { CustomerOrderCancellationResult } from './customer-order-cancellation.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';
const context = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: Object.freeze({}),
} as unknown as AuthenticatedRequestContext;

class IntegrationGateway implements CustomerOrderCancellationGateway {
  public static lastCall: readonly string[] | null = null;

  public cancel(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<CustomerOrderCancellationResult> {
    IntegrationGateway.lastCall = [actorId, orderId, idempotencyKey];
    return Promise.resolve({
      orderId,
      orderNumber: 'VAS-CANCEL-HTTP',
      status: 'CANCELLED',
      paymentStatus: 'COD_PENDING',
      refundId: null,
      refundStatus: null,
      reservationsReleased: 1,
      cancelledAt: '2026-07-26T10:00:00.000Z',
      replayed: false,
    });
  }
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!(server instanceof Server)) throw new TypeError('Expected Node HTTP server');
  return server;
}

describe('customer order cancellation integration contract', () => {
  let app: INestApplication | undefined;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomerOrderCancellationController],
      providers: [
        CustomerOrderCancellationService,
        { provide: CUSTOMER_ORDER_CANCELLATION_GATEWAY, useClass: IntegrationGateway },
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

  it('cancels through the documented customer command route', async () => {
    const response = await request(server)
      .post(`/customer/orders/${ORDER_ID}/cancel`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { cancellation: { orderId: ORDER_ID, status: 'CANCELLED' } },
    });
    expect(IntegrationGateway.lastCall).toStrictEqual([ACTOR_ID, ORDER_ID, IDEMPOTENCY_KEY]);
  });

  it('rejects malformed identifiers before invoking the gateway', async () => {
    const invalidOrder = await request(server)
      .post('/customer/orders/not-a-uuid/cancel')
      .set('Idempotency-Key', IDEMPOTENCY_KEY);
    const missingKey = await request(server).post(`/customer/orders/${ORDER_ID}/cancel`);

    expect(invalidOrder.status).toBe(400);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
  });

  it('keeps cancellation customer-only and readiness protected', () => {
    expect(
      Reflect.getMetadata(ALLOWED_ACCOUNT_TYPES_METADATA, CustomerOrderCancellationController),
    ).toStrictEqual(['CUSTOMER']);
    expect(
      Reflect.getMetadata(OPERATIONAL_READINESS_METADATA, CustomerOrderCancellationController),
    ).toBe(true);
  });
});
