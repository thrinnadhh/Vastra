import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import type { ProfileSnapshot } from '../auth/auth.types';
import { type AuthenticationGateway, type TokenVerificationResult } from '../auth/supabase.gateway';
import { AUTHENTICATION_GATEWAY } from '../auth/supabase.tokens';
import { type MeGateway } from './me.gateway';
import { MeModule } from './me.module';
import { ME_GATEWAY } from './me.tokens';
import type {
  AdminProfileSnapshot,
  CaptainProfileSnapshot,
  CommonProfileSnapshot,
  CustomerProfileSnapshot,
  MerchantProfileSnapshot,
  MerchantShopSnapshot,
} from './me.types';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const USER_ID = '10000000-0000-0000-0000-000000000001';

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    if (accessToken !== 'active-token') {
      return Promise.resolve({ valid: false, reason: 'INVALID' });
    }

    return Promise.resolve({
      valid: true,
      identity: {
        id: USER_ID,
        email: 'customer@example.test',
      },
    });
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    if (userId !== USER_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      id: USER_ID,
      accountType: 'CUSTOMER',
      status: 'ACTIVE',
    });
  }

  public createUserClient(): SupabaseClient {
    return emptySupabaseClient;
  }
}

class IntegrationMeGateway implements MeGateway {
  public findCommonProfile(): Promise<CommonProfileSnapshot | null> {
    return Promise.resolve({
      id: USER_ID,
      accountType: 'CUSTOMER',
      fullName: 'Customer One',
      phoneNumber: '+919999999999',
      avatarUrl: null,
      status: 'ACTIVE',
    });
  }

  public findCustomerProfile(): Promise<CustomerProfileSnapshot | null> {
    return Promise.resolve({
      dateOfBirth: null,
      genderPreference: null,
      profileCompleted: false,
      defaultAddressId: null,
    });
  }

  public findMerchantProfile(): Promise<MerchantProfileSnapshot | null> {
    return Promise.resolve(null);
  }

  public findMerchantShops(): Promise<readonly MerchantShopSnapshot[]> {
    return Promise.resolve([]);
  }

  public findCaptainProfile(): Promise<CaptainProfileSnapshot | null> {
    return Promise.resolve(null);
  }

  public findAdminProfile(): Promise<AdminProfileSnapshot | null> {
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

describe('GET /me integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule, MeModule],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(ME_GATEWAY)
      .useValue(new IntegrationMeGateway())
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
    httpServer = requireHttpServer(app);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('rejects a request without a bearer token', async () => {
    const response = await request(httpServer).get('/me');

    expect(response.status).toBe(401);
  });

  it('returns the authenticated account envelope', async () => {
    const response = await request(httpServer)
      .get('/me')
      .set('Authorization', 'Bearer active-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      success: true,
      data: {
        id: USER_ID,
        email: 'customer@example.test',
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        profile: {
          fullName: 'Customer One',
          phoneNumber: '+919999999999',
          avatarUrl: null,
        },
        roleProfile: {
          kind: 'CUSTOMER',
          dateOfBirth: null,
          genderPreference: null,
          profileCompleted: false,
          defaultAddressId: null,
        },
        scope: {
          kind: 'CUSTOMER',
        },
      },
      meta: {
        requestId: null,
      },
    });
  });
});
