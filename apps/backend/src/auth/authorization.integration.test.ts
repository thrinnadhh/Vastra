import type { SupabaseClient } from './supabase-client.type';
import { Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AllowAccountTypes } from './account-types.decorator';
import { AuthModule } from './auth.module';
import type { ProfileSnapshot } from './auth.types';
import type { AuthorizationGateway } from './authorization.gateway';
import { AUTHORIZATION_GATEWAY } from './authorization.tokens';
import { RequirePermissions } from './permissions.decorator';
import { Public } from './public.decorator';
import type { AuthenticationGateway, TokenVerificationResult } from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

interface IntegrationClientMarker {
  readonly accessToken: string;
}

function createIntegrationClient(accessToken: string): SupabaseClient {
  return Object.freeze({
    accessToken,
  }) as unknown as SupabaseClient;
}

function readIntegrationAccessToken(client: SupabaseClient): string {
  const marker = client as unknown as IntegrationClientMarker;

  return marker.accessToken;
}

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    switch (accessToken) {
      case 'customer-token':
      case 'merchant-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: `${accessToken}-user-id`,
            email: `${accessToken}@example.test`,
          },
          assuranceLevel: 'aal1',
        });
      case 'admin-operations-token':
      case 'admin-read-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: `${accessToken}-user-id`,
            email: `${accessToken}@example.test`,
          },
          assuranceLevel: 'aal2',
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
      case 'customer-token':
        return Promise.resolve({
          id: userId,
          accountType: 'CUSTOMER',
          status: 'ACTIVE',
        });
      case 'merchant-token':
        return Promise.resolve({
          id: userId,
          accountType: 'MERCHANT',
          status: 'ACTIVE',
        });
      case 'admin-operations-token':
      case 'admin-read-token':
        return Promise.resolve({
          id: userId,
          accountType: 'ADMIN',
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

class IntegrationAuthorizationGateway implements AuthorizationGateway {
  public findGrantedPermissionCodes(
    client: SupabaseClient,
    requiredPermissionCodes: readonly string[],
  ): Promise<readonly string[]> {
    const accessToken = readIntegrationAccessToken(client);
    let granted: readonly string[];

    switch (accessToken) {
      case 'admin-operations-token':
        granted = ['platform.read', 'operations.manage'];
        break;
      case 'admin-read-token':
        granted = ['platform.read'];
        break;
      default:
        granted = [];
    }

    return Promise.resolve(
      granted.filter((permissionCode) => requiredPermissionCodes.includes(permissionCode)),
    );
  }
}

@Controller('authorization-probe')
class AuthorizationProbeController {
  @Get('customer')
  @AllowAccountTypes('CUSTOMER')
  public customerOnly(): {
    readonly allowed: true;
  } {
    return { allowed: true };
  }

  @Get('merchant')
  @AllowAccountTypes('MERCHANT')
  public merchantOnly(): {
    readonly allowed: true;
  } {
    return { allowed: true };
  }

  @Get('operations')
  @AllowAccountTypes('ADMIN')
  @RequirePermissions('operations.manage')
  public operationsOnly(): {
    readonly allowed: true;
  } {
    return { allowed: true };
  }

  @Get('public')
  @Public()
  @RequirePermissions('operations.manage')
  public publicProbe(): {
    readonly allowed: true;
  } {
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

describe('authorization guards integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [AuthorizationProbeController],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(AUTHORIZATION_GATEWAY)
      .useValue(new IntegrationAuthorizationGateway())
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

  it('allows the required customer account type', async () => {
    const response = await request(httpServer)
      .get('/authorization-probe/customer')
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      allowed: true,
    });
  });

  it('denies a cross-role account', async () => {
    const response = await request(httpServer)
      .get('/authorization-probe/merchant')
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('allows an admin with the required permission', async () => {
    const response = await request(httpServer)
      .get('/authorization-probe/operations')
      .set('Authorization', 'Bearer admin-operations-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      allowed: true,
    });
  });

  it('denies an admin missing the required permission', async () => {
    const response = await request(httpServer)
      .get('/authorization-probe/operations')
      .set('Authorization', 'Bearer admin-read-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('PERMISSION_DENIED');
  });

  it('keeps public routes public', async () => {
    const response = await request(httpServer).get('/authorization-probe/public');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      allowed: true,
    });
  });
});
