import type { SupabaseClient } from './supabase-client.type';
import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';
import type { AccountType, ProfileSnapshot, ProfileStatus } from './auth.types';
import {
  AuthenticationProviderUnavailableError,
  type AuthenticationGateway,
  type TokenVerificationResult,
} from './supabase.gateway';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;

class FakeAuthenticationGateway implements AuthenticationGateway {
  public verification: TokenVerificationResult = {
    valid: true,
    identity: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'customer@example.test',
    },
  };

  public profile: ProfileSnapshot | null = {
    id: '10000000-0000-0000-0000-000000000001',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  };

  public unavailable = false;

  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    void accessToken;

    if (this.unavailable) {
      return Promise.reject(new AuthenticationProviderUnavailableError());
    }

    return Promise.resolve(this.verification);
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    void userId;

    if (this.unavailable) {
      return Promise.reject(new AuthenticationProviderUnavailableError());
    }

    return Promise.resolve(this.profile);
  }

  public createUserClient(accessToken: string): SupabaseClient {
    void accessToken;
    return emptySupabaseClient;
  }
}

async function captureHttpException(operation: Promise<unknown>): Promise<HttpException> {
  try {
    await operation;
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected operation to reject');
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function requireErrorCode(exception: HttpException): string {
  const response: unknown = exception.getResponse();

  if (!isObject(response) || !('error' in response)) {
    throw new TypeError('Expected structured API error response');
  }

  const error: unknown = response.error;

  if (!isObject(error) || !('code' in error)) {
    throw new TypeError('Expected error object in API response');
  }

  const code: unknown = error.code;

  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code in response');
  }

  return code;
}

function createProfile(accountType: AccountType, status: ProfileStatus): ProfileSnapshot {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    accountType,
    status,
  };
}

describe('AuthService', () => {
  it('creates an active authenticated request context', async () => {
    const gateway = new FakeAuthenticationGateway();

    const result = await new AuthService(gateway).authenticate('active-access-token');

    expect(result.actor).toStrictEqual({
      id: '10000000-0000-0000-0000-000000000001',
      email: 'customer@example.test',
      accountType: 'CUSTOMER',
      status: 'ACTIVE',
    });

    expect(result.accessToken).toBe('active-access-token');
    expect(result.supabase).toBe(emptySupabaseClient);
  });

  it('rejects an invalid token', async () => {
    const gateway = new FakeAuthenticationGateway();
    gateway.verification = {
      valid: false,
      reason: 'INVALID',
    };

    const exception = await captureHttpException(
      new AuthService(gateway).authenticate('invalid-access-token'),
    );

    expect(exception.getStatus()).toBe(401);
    expect(requireErrorCode(exception)).toBe('AUTH_REQUIRED');
  });

  it('reports an expired token distinctly', async () => {
    const gateway = new FakeAuthenticationGateway();
    gateway.verification = {
      valid: false,
      reason: 'EXPIRED',
    };

    const exception = await captureHttpException(
      new AuthService(gateway).authenticate('expired-access-token'),
    );

    expect(exception.getStatus()).toBe(401);
    expect(requireErrorCode(exception)).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('rejects a missing application profile', async () => {
    const gateway = new FakeAuthenticationGateway();
    gateway.profile = null;

    const exception = await captureHttpException(
      new AuthService(gateway).authenticate('active-access-token'),
    );

    expect(exception.getStatus()).toBe(403);
    expect(requireErrorCode(exception)).toBe('ACCOUNT_PENDING');
  });

  it('rejects a pending account', async () => {
    const gateway = new FakeAuthenticationGateway();
    gateway.profile = createProfile('CUSTOMER', 'PENDING');

    const exception = await captureHttpException(
      new AuthService(gateway).authenticate('active-access-token'),
    );

    expect(exception.getStatus()).toBe(403);
    expect(requireErrorCode(exception)).toBe('ACCOUNT_PENDING');
  });

  it.each(['BLOCKED', 'SUSPENDED', 'DELETED'] as const)(
    'rejects a %s account as blocked',
    async (status) => {
      const gateway = new FakeAuthenticationGateway();

      gateway.profile = createProfile('CUSTOMER', status);

      const exception = await captureHttpException(
        new AuthService(gateway).authenticate('active-access-token'),
      );

      expect(exception.getStatus()).toBe(403);
      expect(requireErrorCode(exception)).toBe('ACCOUNT_BLOCKED');
    },
  );

  it('maps provider failures to a retryable service error', async () => {
    const gateway = new FakeAuthenticationGateway();
    gateway.unavailable = true;

    const exception = await captureHttpException(
      new AuthService(gateway).authenticate('active-access-token'),
    );

    expect(exception.getStatus()).toBe(503);
    expect(requireErrorCode(exception)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
