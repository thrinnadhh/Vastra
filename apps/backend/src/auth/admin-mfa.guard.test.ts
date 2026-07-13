import type { SupabaseClient } from './supabase-client.type';

import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminMfaGuard } from './admin-mfa.guard';
import type {
  AuthenticatedHttpRequest,
  AuthenticatedRequestContext,
  AuthenticatorAssuranceLevel,
} from './auth.types';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

const client = Object.freeze({}) as unknown as SupabaseClient;

class TestController {
  public readonly marker = 'admin-mfa-test-controller';
}

function createContext(
  accountType: 'CUSTOMER' | 'MERCHANT' | 'CAPTAIN' | 'ADMIN',
  assuranceLevel?: AuthenticatorAssuranceLevel,
): AuthenticatedRequestContext {
  return {
    actor: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'actor@example.test',
      accountType,
      status: 'ACTIVE',
    },
    accessToken: 'access-token',
    ...(assuranceLevel === undefined ? {} : { assuranceLevel }),
    supabase: client,
  };
}

function createExecutionContext(request: AuthenticatedHttpRequest): ExecutionContext {
  const handler = () => undefined;

  return {
    getType: () => 'http',
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
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

describe('AdminMfaGuard', () => {
  let reflector: Reflector;
  let guard: AdminMfaGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AdminMfaGuard(reflector);
  });

  it('keeps public routes public', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) =>
      metadataKey === PUBLIC_ROUTE_METADATA ? true : undefined,
    );

    expect(guard.canActivate(createExecutionContext({ headers: {} }))).toBe(true);
  });

  it('allows non-admin sessions without MFA', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(
      guard.canActivate(
        createExecutionContext({
          headers: {},
          authContext: createContext('CUSTOMER', 'aal1'),
        }),
      ),
    ).toBe(true);
  });

  it('allows an administrator with an aal2 session', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(
      guard.canActivate(
        createExecutionContext({
          headers: {},
          authContext: createContext('ADMIN', 'aal2'),
        }),
      ),
    ).toBe(true);
  });

  it('rejects an administrator with an aal1 session', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const error = captureSynchronousError(() => {
      guard.canActivate(
        createExecutionContext({
          headers: {},
          authContext: createContext('ADMIN', 'aal1'),
        }),
      );
    });

    expect(readErrorCode(error)).toBe('MFA_REQUIRED');
  });

  it('fails closed for an administrator with no aal claim', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const error = captureSynchronousError(() => {
      guard.canActivate(
        createExecutionContext({
          headers: {},
          authContext: createContext('ADMIN'),
        }),
      );
    });

    expect(readErrorCode(error)).toBe('MFA_REQUIRED');
  });
});
