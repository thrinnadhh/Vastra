import type { SupabaseClient } from './supabase-client.type';
import { Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AllowAccountTypes } from './account-types.decorator';
import { AuthModule } from './auth.module';
import type { ProfileSnapshot } from './auth.types';
import { Public } from './public.decorator';
import type { AuthenticationGateway, TokenVerificationResult } from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

const testClient = Object.freeze({}) as unknown as SupabaseClient;

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    switch (accessToken) {
      case 'admin-aal2-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000001',
            email: 'admin@example.test',
          },
          assuranceLevel: 'aal2',
        });
      case 'admin-aal1-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000001',
            email: 'admin@example.test',
          },
          assuranceLevel: 'aal1',
        });
      case 'admin-legacy-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000001',
            email: 'admin@example.test',
          },
        });
      case 'customer-aal1-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000002',
            email: 'customer@example.test',
          },
          assuranceLevel: 'aal1',
        });
      default:
        return Promise.resolve({
          valid: false,
          reason: 'INVALID',
        });
    }
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    switch (userId) {
      case '10000000-0000-0000-0000-000000000001':
        return Promise.resolve({
          id: userId,
          accountType: 'ADMIN',
          status: 'ACTIVE',
        });
      case '10000000-0000-0000-0000-000000000002':
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
    void accessToken;
    return testClient;
  }
}

@Controller('admin-mfa-probe')
class AdminMfaProbeController {
  @Get('admin')
  @AllowAccountTypes('ADMIN')
  public adminOnly(): { readonly allowed: true } {
    return { allowed: true };
  }

  @Get('customer')
  @AllowAccountTypes('CUSTOMER')
  public customerOnly(): { readonly allowed: true } {
    return { allowed: true };
  }

  @Get('public')
  @Public()
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

describe('admin MFA integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [AdminMfaProbeController],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
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

  it('allows an administrator after second-factor verification', async () => {
    const response = await request(httpServer)
      .get('/admin-mfa-probe/admin')
      .set('Authorization', 'Bearer admin-aal2-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });

  it('requires MFA for an administrator with an aal1 session', async () => {
    const response = await request(httpServer)
      .get('/admin-mfa-probe/admin')
      .set('Authorization', 'Bearer admin-aal1-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('MFA_REQUIRED');
  });

  it('fails closed for a legacy administrator token without aal', async () => {
    const response = await request(httpServer)
      .get('/admin-mfa-probe/admin')
      .set('Authorization', 'Bearer admin-legacy-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('MFA_REQUIRED');
  });

  it('does not require MFA from a customer session', async () => {
    const response = await request(httpServer)
      .get('/admin-mfa-probe/customer')
      .set('Authorization', 'Bearer customer-aal1-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });

  it('keeps public routes public', async () => {
    const response = await request(httpServer).get('/admin-mfa-probe/public');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ allowed: true });
  });
});
