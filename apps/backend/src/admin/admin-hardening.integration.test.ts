import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import type { ProfileSnapshot } from '../auth/auth.types';
import type { AuthorizationGateway } from '../auth/authorization.gateway';
import { AUTHORIZATION_GATEWAY } from '../auth/authorization.tokens';
import type { OperationalReadinessGateway } from '../auth/operational-readiness.gateway';
import { OPERATIONAL_READINESS_GATEWAY } from '../auth/operational-readiness.tokens';
import type { AuthenticationGateway, TokenVerificationResult } from '../auth/supabase.gateway';
import { AUTHENTICATION_GATEWAY } from '../auth/supabase.tokens';
import type { AdminDashboardGateway } from './admin-dashboard.gateway';
import type {
  AdminOperationInput,
  AdminOrderOperationsGateway,
  AdminResetVerificationInput,
} from './admin-order-operations.gateway';
import { AdminModule } from './admin.module';
import { ADMIN_DASHBOARD_GATEWAY, ADMIN_ORDER_OPERATIONS_GATEWAY } from './admin.tokens';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '10000000-0000-4000-8000-000000000002';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';

interface TokenContract {
  readonly userId: string;
  readonly assuranceLevel: 'aal1' | 'aal2';
  readonly grants: readonly string[];
}

const TOKENS: Readonly<Record<string, TokenContract>> = {
  'admin-aal2-read': {
    userId: ADMIN_ID,
    assuranceLevel: 'aal2',
    grants: ['admin.dashboard.read'],
  },
  'admin-aal2-none': {
    userId: ADMIN_ID,
    assuranceLevel: 'aal2',
    grants: [],
  },
  'admin-aal2-manage': {
    userId: ADMIN_ID,
    assuranceLevel: 'aal2',
    grants: ['admin.orders.manage'],
  },
  'admin-aal1-read': {
    userId: ADMIN_ID,
    assuranceLevel: 'aal1',
    grants: ['admin.dashboard.read'],
  },
  'customer-aal1': {
    userId: CUSTOMER_ID,
    assuranceLevel: 'aal1',
    grants: ['admin.dashboard.read'],
  },
};

function readClientToken(client: SupabaseClient): string {
  const token = (client as unknown as Record<string, unknown>)['accessToken'];
  if (typeof token !== 'string') throw new TypeError('Expected integration access token');
  return token;
}

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    const contract = TOKENS[accessToken];
    if (contract === undefined) return Promise.resolve({ valid: false, reason: 'INVALID' });
    return Promise.resolve({
      valid: true,
      identity: {
        id: contract.userId,
        email: contract.userId === ADMIN_ID ? 'admin@example.test' : 'customer@example.test',
      },
      assuranceLevel: contract.assuranceLevel,
    });
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    if (userId === ADMIN_ID) {
      return Promise.resolve({ id: userId, accountType: 'ADMIN', status: 'ACTIVE' });
    }
    if (userId === CUSTOMER_ID) {
      return Promise.resolve({ id: userId, accountType: 'CUSTOMER', status: 'ACTIVE' });
    }
    return Promise.resolve(null);
  }

  public createUserClient(accessToken: string): SupabaseClient {
    return { accessToken } as unknown as SupabaseClient;
  }
}

class IntegrationAuthorizationGateway implements AuthorizationGateway {
  public findGrantedPermissionCodes(
    client: SupabaseClient,
    requiredPermissionCodes: readonly string[],
  ): Promise<readonly string[]> {
    const grants = TOKENS[readClientToken(client)]?.grants ?? [];
    return Promise.resolve(
      requiredPermissionCodes.filter((permission) => grants.includes(permission)),
    );
  }
}

class IntegrationReadinessGateway implements OperationalReadinessGateway {
  public calls = 0;

  public findMerchantOperationalProfile() {
    this.calls += 1;
    return Promise.resolve(null);
  }

  public findCaptainOperationalProfile() {
    this.calls += 1;
    return Promise.resolve(null);
  }
}

class IntegrationDashboardGateway implements AdminDashboardGateway {
  public getSummary() {
    return Promise.resolve({
      openOrders: 7,
      interventionOrders: 2,
      searchingDeliveries: 1,
      activeDeliveries: 3,
      openCases: 4,
      suspendedMerchants: 1,
      suspendedCaptains: 0,
      generatedAt: '2026-07-18T09:00:00.000Z',
    });
  }

  public search() {
    return Promise.resolve([]);
  }
}

class IntegrationOrderOperationsGateway implements AdminOrderOperationsGateway {
  public lastInput: AdminOperationInput | AdminResetVerificationInput | null = null;

  private capture(input: AdminOperationInput | AdminResetVerificationInput) {
    this.lastInput = input;
    return Promise.resolve({ orderId: input.resourceId, orderStatus: 'CANCELLED' });
  }

  public cancelOrder(input: AdminOperationInput) {
    return this.capture(input);
  }

  public retryDispatch(input: AdminOperationInput) {
    return this.capture(input);
  }

  public releaseDelivery(input: AdminOperationInput) {
    return this.capture(input);
  }

  public resetVerification(input: AdminResetVerificationInput) {
    return this.capture(input);
  }
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!(server instanceof Server)) throw new TypeError('Expected a Node HTTP server');
  return server;
}

function readErrorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new TypeError('Expected response object');
  }
  const error = (body as Record<string, unknown>)['error'];
  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    throw new TypeError('Expected error object');
  }
  const code = (error as Record<string, unknown>)['code'];
  if (typeof code !== 'string') throw new TypeError('Expected error code');
  return code;
}

describe('Sprint 9 admin hardening integration', () => {
  let app: INestApplication | undefined;
  let server: Server;
  let readinessGateway: IntegrationReadinessGateway;
  let orderOperationsGateway: IntegrationOrderOperationsGateway;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    readinessGateway = new IntegrationReadinessGateway();
    orderOperationsGateway = new IntegrationOrderOperationsGateway();

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule, AdminModule],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(AUTHORIZATION_GATEWAY)
      .useValue(new IntegrationAuthorizationGateway())
      .overrideProvider(OPERATIONAL_READINESS_GATEWAY)
      .useValue(readinessGateway)
      .overrideProvider(ADMIN_DASHBOARD_GATEWAY)
      .useValue(new IntegrationDashboardGateway())
      .overrideProvider(ADMIN_ORDER_OPERATIONS_GATEWAY)
      .useValue(orderOperationsGateway)
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
    server = requireHttpServer(app);
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
  });

  it('allows an AAL2 administrator with the required read permission', async () => {
    const response = await request(server)
      .get('/admin/dashboard')
      .set('Authorization', 'Bearer admin-aal2-read');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ openOrders: 7, interventionOrders: 2 });
    expect(readinessGateway.calls).toBe(0);
  });

  it('requires AAL2 before evaluating admin permissions', async () => {
    const response = await request(server)
      .get('/admin/dashboard')
      .set('Authorization', 'Bearer admin-aal1-read');
    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('MFA_REQUIRED');
  });

  it('denies an AAL2 administrator without the route permission', async () => {
    const response = await request(server)
      .get('/admin/dashboard')
      .set('Authorization', 'Bearer admin-aal2-none');
    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('PERMISSION_DENIED');
  });

  it('rejects a non-admin account even when its client advertises the permission', async () => {
    const response = await request(server)
      .get('/admin/dashboard')
      .set('Authorization', 'Bearer customer-aal1');
    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('keeps read-only administrators away from mutation routes', async () => {
    const response = await request(server)
      .post(`/admin/orders/${ORDER_ID}/cancel`)
      .set('Authorization', 'Bearer admin-aal2-read')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ reasonCode: 'CUSTOMER_REQUEST' });
    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('PERMISSION_DENIED');
  });

  it('executes a narrow mutation for an AAL2 administrator with manage permission', async () => {
    const response = await request(server)
      .post(`/admin/orders/${ORDER_ID}/cancel`)
      .set('Authorization', 'Bearer admin-aal2-manage')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .set('X-Request-Id', 's9-10-integration')
      .send({ reasonCode: 'CUSTOMER_REQUEST', note: 'Customer confirmed cancellation' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ orderId: ORDER_ID, orderStatus: 'CANCELLED' });
    expect(orderOperationsGateway.lastInput).toMatchObject({
      actorId: ADMIN_ID,
      resourceId: ORDER_ID,
      reasonCode: 'CUSTOMER_REQUEST',
      idempotencyKey: IDEMPOTENCY_KEY,
      requestId: 's9-10-integration',
    });
    expect(readinessGateway.calls).toBe(0);
  });
});
