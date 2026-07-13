import type { SupabaseClient } from './supabase-client.type';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from './account-types.decorator';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from './auth.types';
import { AuthorizationGuard } from './authorization.guard';
import { type AuthorizationService } from './authorization.service';
import { REQUIRED_PERMISSIONS_METADATA } from './permissions.decorator';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

const client = Object.freeze({}) as unknown as SupabaseClient;

class TestController {
  public readonly marker = 'authorization-test-controller';
}

function createAuthContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'admin@example.test',
      accountType: 'ADMIN',
      status: 'ACTIVE',
    },
    accessToken: 'access-token',
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

describe('AuthorizationGuard', () => {
  let reflector: Reflector;
  let guard: AuthorizationGuard;
  let assertAllowedAccountType: Mock;
  let assertPermissions: Mock;

  beforeEach(() => {
    reflector = new Reflector();
    assertAllowedAccountType = vi.fn();
    assertPermissions = vi.fn().mockResolvedValue(undefined);

    const authorizationService = {
      assertAllowedAccountType,
      assertPermissions,
    } as unknown as AuthorizationService;

    guard = new AuthorizationGuard(reflector, authorizationService);
  });

  it('bypasses authorization for a public route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === PUBLIC_ROUTE_METADATA) {
        return true;
      }

      return undefined;
    });

    await expect(guard.canActivate(createExecutionContext({ headers: {} }))).resolves.toBe(true);

    expect(assertAllowedAccountType).not.toHaveBeenCalled();
    expect(assertPermissions).not.toHaveBeenCalled();
  });

  it('applies account-type and permission metadata', async () => {
    const authContext = createAuthContext();

    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === PUBLIC_ROUTE_METADATA) {
        return false;
      }

      if (metadataKey === ALLOWED_ACCOUNT_TYPES_METADATA) {
        return ['ADMIN'];
      }

      if (metadataKey === REQUIRED_PERMISSIONS_METADATA) {
        return ['operations.manage'];
      }

      return undefined;
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {},
          authContext,
        }),
      ),
    ).resolves.toBe(true);

    expect(assertAllowedAccountType).toHaveBeenCalledWith('ADMIN', ['ADMIN']);
    expect(assertPermissions).toHaveBeenCalledWith(authContext, ['operations.manage']);
  });
});
