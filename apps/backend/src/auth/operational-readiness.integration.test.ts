import type { SupabaseClient } from './supabase-client.type';
import { Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AllowAccountTypes } from './account-types.decorator';
import { AuthModule } from './auth.module';
import type { ProfileSnapshot } from './auth.types';
import { RequireOperationalReadiness } from './operational-readiness.decorator';
import type { OperationalReadinessGateway } from './operational-readiness.gateway';
import { OPERATIONAL_READINESS_GATEWAY } from './operational-readiness.tokens';
import type {
  CaptainOperationalProfile,
  MerchantOperationalProfile,
} from './operational-readiness.types';
import { Public } from './public.decorator';
import type { AuthenticationGateway, TokenVerificationResult } from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

interface IntegrationClientMarker {
  readonly accessToken: string;
}

function createIntegrationClient(accessToken: string): SupabaseClient {
  return Object.freeze({ accessToken }) as unknown as SupabaseClient;
}

function readIntegrationAccessToken(client: SupabaseClient): string {
  const marker = client as unknown as IntegrationClientMarker;
  return marker.accessToken;
}

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    switch (accessToken) {
      case 'merchant-ready-token':
      case 'merchant-pending-token':
      case 'merchant-suspended-token':
      case 'captain-ready-token':
      case 'captain-pending-token':
      case 'customer-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: `${accessToken}-user-id`,
            email: `${accessToken}@example.test`,
          },
        });
      default:
        return Promise.resolve({
          valid: false,
          reason: 'INVALID',
        });
    }
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    const accessToken = userId.replace(/-user-id$/u, '');

    switch (accessToken) {
      case 'merchant-ready-token':
      case 'merchant-pending-token':
      case 'merchant-suspended-token':
        return Promise.resolve({
          id: userId,
          accountType: 'MERCHANT',
          status: 'ACTIVE',
        });
      case 'captain-ready-token':
      case 'captain-pending-token':
        return Promise.resolve({
          id: userId,
          accountType: 'CAPTAIN',
          status: 'ACTIVE',
        });
      case 'customer-token':
        return Promise.resolve({
          id: userId,
          accountType: 'CUSTOMER',
          status: 'ACTIVE',
        });
      default:
        return Promise.resolve(null);
    }
  }

  public createUserClient(accessToken: string): SupabaseClient {
    return createIntegrationClient(accessToken);
  }
}

class IntegrationOperationalReadinessGateway implements OperationalReadinessGateway {
  public findMerchantOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<MerchantOperationalProfile | null> {
    if (!userId.endsWith('-user-id')) {
      return Promise.resolve(null);
    }

    switch (readIntegrationAccessToken(client)) {
      case 'merchant-ready-token':
        return Promise.resolve({
          onboardingStatus: 'ACTIVE',
          kycStatus: 'VERIFIED',
          approvedAt: '2026-07-13T00:00:00.000Z',
        });
      case 'merchant-pending-token':
        return Promise.resolve({
          onboardingStatus: 'VERIFICATION_PENDING',
          kycStatus: 'IN_REVIEW',
          approvedAt: null,
        });
      case 'merchant-suspended-token':
        return Promise.resolve({
          onboardingStatus: 'SUSPENDED',
          kycStatus: 'VERIFIED',
          approvedAt: '2026-07-13T00:00:00.000Z',
        });
      default:
        return Promise.resolve(null);
    }
  }

  public findCaptainOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CaptainOperationalProfile | null> {
    if (!userId.endsWith('-user-id')) {
      return Promise.resolve(null);
    }

    switch (readIntegrationAccessToken(client)) {
      case 'captain-ready-token':
        return Promise.resolve({
          kycStatus: 'VERIFIED',
          availabilityStatus: 'OFFLINE',
          approvedAt: '2026-07-13T00:00:00.000Z',
        });
      case 'captain-pending-token':
        return Promise.resolve({
          kycStatus: 'PENDING',
          availabilityStatus: 'OFFLINE',
          approvedAt: null,
        });
      default:
        return Promise.resolve(null);
    }
  }
}

@Controller('operational-readiness-probe')
class OperationalReadinessProbeController {
  @Get('merchant')
  @AllowAccountTypes('MERCHANT')
  @RequireOperationalReadiness()
  public merchantOnly(): { readonly allowed: true } {
    return { allowed: true };
  }

  @Get('captain')
  @AllowAccountTypes('CAPTAIN')
  @RequireOperationalReadiness()
  public captainOnly(): { readonly allowed: true } {
    return { allowed: true };
  }

  @Get('public')
  @Public()
  @RequireOperationalReadiness()
  public publicProbe(): { readonly allowed: true } {
    return { allowed: true };
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

function readErrorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new TypeError('Expected response object');
  }

  const error = (body as Record<string, unknown>)['error'];

  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    throw new TypeError('Expected error object');
  }

  const code = (error as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('operational readiness integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [OperationalReadinessProbeController],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(OPERATIONAL_READINESS_GATEWAY)
      .useValue(new IntegrationOperationalReadinessGateway())
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

  it('allows a ready merchant', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/merchant')
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });

  it('keeps a pending merchant out of operational actions', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/merchant')
      .set('Authorization', 'Bearer merchant-pending-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_PENDING');
  });

  it('blocks a suspended merchant', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/merchant')
      .set('Authorization', 'Bearer merchant-suspended-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_BLOCKED');
  });

  it('allows an approved captain while offline', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/captain')
      .set('Authorization', 'Bearer captain-ready-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });

  it('keeps an unapproved captain out of operational actions', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/captain')
      .set('Authorization', 'Bearer captain-pending-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_PENDING');
  });

  it('denies a customer before readiness lookup', async () => {
    const response = await request(httpServer)
      .get('/operational-readiness-probe/merchant')
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('keeps public routes public', async () => {
    const response = await request(httpServer).get('/operational-readiness-probe/public');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });
});
