import type { SupabaseClient } from './supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AuthorizationGatewayUnavailableError,
  type AuthorizationGateway,
} from './authorization.gateway';
import { AuthorizationService } from './authorization.service';
import type { AuthenticatedRequestContext } from './auth.types';

const client = Object.freeze({}) as unknown as SupabaseClient;

class FakeAuthorizationGateway implements AuthorizationGateway {
  public grantedPermissionCodes: readonly string[] = [];
  public error: Error | null = null;
  public calls = 0;
  public receivedClient: SupabaseClient | null = null;
  public receivedPermissionCodes: readonly string[] = [];

  public findGrantedPermissionCodes(
    receivedClient: SupabaseClient,
    requiredPermissionCodes: readonly string[],
  ): Promise<readonly string[]> {
    this.calls += 1;
    this.receivedClient = receivedClient;
    this.receivedPermissionCodes = requiredPermissionCodes;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.grantedPermissionCodes);
  }
}

function createContext(
  accountType: 'CUSTOMER' | 'MERCHANT' | 'CAPTAIN' | 'ADMIN',
): AuthenticatedRequestContext {
  return {
    actor: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'actor@example.test',
      accountType,
      status: 'ACTIVE',
    },
    accessToken: 'access-token',
    supabase: client,
  };
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected an HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected an object response');
  }

  const errorBody = (response as Record<string, unknown>)['error'];

  if (typeof errorBody !== 'object' || errorBody === null || Array.isArray(errorBody)) {
    throw new TypeError('Expected an error body');
  }

  const code = (errorBody as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected an error code');
  }

  return code;
}

function captureSynchronousError(action: () => void): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }

  throw new Error('Expected the action to throw');
}

describe('AuthorizationService', () => {
  let gateway: FakeAuthorizationGateway;
  let service: AuthorizationService;

  beforeEach(() => {
    gateway = new FakeAuthorizationGateway();
    service = new AuthorizationService(gateway);
  });

  it('allows a matching account type', () => {
    expect(() => {
      service.assertAllowedAccountType('MERCHANT', ['MERCHANT', 'ADMIN']);
    }).not.toThrow();
  });

  it('rejects a non-matching account type', () => {
    const error = captureSynchronousError(() => {
      service.assertAllowedAccountType('CUSTOMER', ['MERCHANT']);
    });

    expect(readErrorCode(error)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('allows an admin with every required permission', async () => {
    gateway.grantedPermissionCodes = ['platform.read', 'operations.manage'];

    await expect(
      service.assertPermissions(createContext('ADMIN'), ['platform.read', 'operations.manage']),
    ).resolves.toBeUndefined();

    expect(gateway.calls).toBe(1);
    expect(gateway.receivedClient).toBe(client);
    expect(gateway.receivedPermissionCodes).toStrictEqual(['platform.read', 'operations.manage']);
  });

  it('deduplicates required permission codes', async () => {
    gateway.grantedPermissionCodes = ['platform.read'];

    await expect(
      service.assertPermissions(createContext('ADMIN'), ['platform.read', 'platform.read']),
    ).resolves.toBeUndefined();

    expect(gateway.receivedPermissionCodes).toStrictEqual(['platform.read']);
  });

  it('rejects an admin missing any required permission', async () => {
    gateway.grantedPermissionCodes = ['platform.read'];

    await expect(
      service.assertPermissions(createContext('ADMIN'), ['platform.read', 'operations.manage']),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'PERMISSION_DENIED');
  });

  it('rejects a non-admin without querying permissions', async () => {
    await expect(
      service.assertPermissions(createContext('CUSTOMER'), ['platform.read']),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'PERMISSION_DENIED');

    expect(gateway.calls).toBe(0);
  });

  it('maps provider failures to a retryable service error', async () => {
    gateway.error = new AuthorizationGatewayUnavailableError();

    await expect(
      service.assertPermissions(createContext('ADMIN'), ['platform.read']),
    ).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
