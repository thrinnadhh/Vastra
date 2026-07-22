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
import type { CustomerProfileGateway } from './customer-profile.gateway';
import { CUSTOMER_PROFILE_GATEWAY } from './customer-profile.tokens';
import type { UpdateCustomerProfileInput } from './customer-profile.types';
import type { MeGateway } from './me.gateway';
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
const USER_ID = '10000000-0000-4000-8000-000000000001';

class ProfileAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    if (accessToken !== 'active-token') {
      return Promise.resolve({ valid: false, reason: 'INVALID' });
    }

    return Promise.resolve({
      valid: true,
      identity: { id: USER_ID, email: 'customer@example.test' },
    });
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    return Promise.resolve(
      userId === USER_ID ? { id: USER_ID, accountType: 'CUSTOMER', status: 'ACTIVE' } : null,
    );
  }

  public createUserClient(): SupabaseClient {
    return emptySupabaseClient;
  }
}

class MutableMeGateway implements MeGateway {
  public fullName: string | null = null;
  public profileCompleted = false;

  public findCommonProfile(): Promise<CommonProfileSnapshot | null> {
    return Promise.resolve({
      id: USER_ID,
      accountType: 'CUSTOMER',
      fullName: this.fullName,
      phoneNumber: '+919999999999',
      avatarUrl: null,
      status: 'ACTIVE',
    });
  }

  public findCustomerProfile(): Promise<CustomerProfileSnapshot | null> {
    return Promise.resolve({
      dateOfBirth: null,
      genderPreference: null,
      profileCompleted: this.profileCompleted,
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

class MutableCustomerProfileGateway implements CustomerProfileGateway {
  public constructor(private readonly meGateway: MutableMeGateway) {}

  public updateCurrentCustomerProfile(_client: SupabaseClient, input: UpdateCustomerProfileInput) {
    this.meGateway.fullName = input.fullName;
    this.meGateway.profileCompleted = true;
    return Promise.resolve({
      fullName: input.fullName,
      profileCompleted: true as const,
      updatedAt: '2026-07-22T04:00:00.000Z',
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

describe('PATCH /me/profile integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const meGateway = new MutableMeGateway();
    const testingModule = await Test.createTestingModule({ imports: [AuthModule, MeModule] })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new ProfileAuthenticationGateway())
      .overrideProvider(ME_GATEWAY)
      .useValue(meGateway)
      .overrideProvider(CUSTOMER_PROFILE_GATEWAY)
      .useValue(new MutableCustomerProfileGateway(meGateway))
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

  it('requires authentication', async () => {
    const response = await request(httpServer).patch('/me/profile').send({ fullName: 'Trinadh B' });

    expect(response.status).toBe(401);
  });

  it('rejects invalid profile input', async () => {
    const response = await request(httpServer)
      .patch('/me/profile')
      .set('Authorization', 'Bearer active-token')
      .send({ fullName: ' ' });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Customer profile input is invalid.',
        details: null,
        retryable: false,
      },
      requestId: null,
    });
  });

  it('updates required profile data and returns the authoritative account', async () => {
    const response = await request(httpServer)
      .patch('/me/profile')
      .set('Authorization', 'Bearer active-token')
      .send({ fullName: '  Trinadh   B ' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      success: true,
      data: {
        id: USER_ID,
        email: 'customer@example.test',
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        profile: {
          fullName: 'Trinadh B',
          phoneNumber: '+919999999999',
          avatarUrl: null,
        },
        roleProfile: {
          kind: 'CUSTOMER',
          dateOfBirth: null,
          genderPreference: null,
          profileCompleted: true,
          defaultAddressId: null,
        },
        scope: { kind: 'CUSTOMER' },
      },
      meta: { requestId: null },
    });
  });
});
