import type { SupabaseClient } from './supabase-client.type';
import { Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthModule } from './auth.module';
import type { AuthenticatedActor, ProfileSnapshot } from './auth.types';
import { CurrentActor } from './current-actor.decorator';
import { type AuthenticationGateway, type TokenVerificationResult } from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    switch (accessToken) {
      case 'active-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000001',
            email: 'active@example.test',
          },
        });
      case 'blocked-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: '10000000-0000-0000-0000-000000000002',
            email: 'blocked@example.test',
          },
        });
      case 'expired-token':
        return Promise.resolve({ valid: false, reason: 'EXPIRED' });
      default:
        return Promise.resolve({ valid: false, reason: 'INVALID' });
    }
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    if (userId === '10000000-0000-0000-0000-000000000001') {
      return Promise.resolve({
        id: userId,
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
      });
    }

    if (userId === '10000000-0000-0000-0000-000000000002') {
      return Promise.resolve({
        id: userId,
        accountType: 'CUSTOMER',
        status: 'BLOCKED',
      });
    }

    return Promise.resolve(null);
  }

  public createUserClient(): SupabaseClient {
    return emptySupabaseClient;
  }
}

@Controller('protected-probe')
class ProtectedProbeController {
  @Get()
  public getProtectedProbe(@CurrentActor() actor: AuthenticatedActor): {
    readonly id: string;
    readonly accountType: string;
  } {
    return {
      id: actor.id,
      accountType: actor.accountType,
    };
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

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected HTTP response body to be an object');
  }

  return value as Record<string, unknown>;
}

describe('authenticated request context integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ProtectedProbeController],
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

  it('rejects a protected route without a bearer token', async () => {
    const response = await request(httpServer).get('/protected-probe');
    const body = requireRecord(response.body);
    const error = requireRecord(body['error']);

    expect(response.status).toBe(401);
    expect(error['code']).toBe('AUTH_REQUIRED');
  });

  it('rejects an expired bearer token', async () => {
    const response = await request(httpServer)
      .get('/protected-probe')
      .set('Authorization', 'Bearer expired-token');

    const body = requireRecord(response.body);
    const error = requireRecord(body['error']);

    expect(response.status).toBe(401);
    expect(error['code']).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('rejects a blocked account', async () => {
    const response = await request(httpServer)
      .get('/protected-probe')
      .set('Authorization', 'Bearer blocked-token');

    const body = requireRecord(response.body);
    const error = requireRecord(body['error']);

    expect(response.status).toBe(403);
    expect(error['code']).toBe('ACCOUNT_BLOCKED');
  });

  it('injects the active authenticated actor', async () => {
    const response = await request(httpServer)
      .get('/protected-probe')
      .set('Authorization', 'Bearer active-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: '10000000-0000-0000-0000-000000000001',
      accountType: 'CUSTOMER',
    });
  });
});
