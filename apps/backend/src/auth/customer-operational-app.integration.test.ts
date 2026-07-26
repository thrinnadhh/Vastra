import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../app.module';
import { CustomerOrderService } from '../orders/customer-order.service';
import type { SupabaseClient } from './supabase-client.type';
import type {
  AuthenticationGateway,
  TokenVerificationResult,
} from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

const CUSTOMER_ID = '10000000-0000-4000-8000-000000000001';
const CUSTOMER_TOKEN = 'customer-operational-token';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

class CustomerAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    if (accessToken !== CUSTOMER_TOKEN) {
      return Promise.resolve({ valid: false, reason: 'INVALID' });
    }

    return Promise.resolve({
      valid: true,
      identity: {
        id: CUSTOMER_ID,
        email: 'customer@example.test',
      },
      assuranceLevel: 'aal1',
    });
  }

  public findProfile(userId: string) {
    if (userId !== CUSTOMER_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      id: CUSTOMER_ID,
      accountType: 'CUSTOMER' as const,
      status: 'ACTIVE' as const,
    });
  }

  public createUserClient(): SupabaseClient {
    return emptyClient;
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

describe('customer operational routes through the assembled application', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  const placeCodOrder = vi.fn().mockResolvedValue({
    success: true,
    data: {
      order: {
        id: '20000000-0000-4000-8000-000000000001',
      },
    },
    meta: { requestId: null },
  });

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new CustomerAuthenticationGateway())
      .overrideProvider(CustomerOrderService)
      .useValue({ placeCodOrder })
      .compile();

    app = testingModule.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    httpServer = requireHttpServer(app);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('allows an active customer through authentication, authorization, and readiness', async () => {
    const response = await request(httpServer)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
      .set('Idempotency-Key', '30000000-0000-4000-8000-000000000001')
      .send({});

    expect(response.status).toBe(200);
    expect(placeCodOrder).toHaveBeenCalledOnce();
  });

  it('still rejects unauthenticated customer operations', async () => {
    const response = await request(httpServer).post('/v1/orders').send({});

    expect(response.status).toBe(401);
  });

  it('still rejects a customer from merchant operations', async () => {
    const response = await request(httpServer)
      .get('/v1/merchant/orders')
      .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`);

    expect(response.status).toBe(403);
  });
});
