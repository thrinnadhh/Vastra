import type { SupabaseClient } from './supabase-client.type';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from './auth.types';
import { OPERATIONAL_READINESS_METADATA } from './operational-readiness.decorator';
import { OperationalReadinessGuard } from './operational-readiness.guard';
import type { OperationalReadinessService } from './operational-readiness.service';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

const client = Object.freeze({}) as unknown as SupabaseClient;

class TestController {
  public readonly marker = 'operational-readiness-test-controller';
}

class FakeOperationalReadinessService {
  public calls = 0;
  public receivedContext: AuthenticatedRequestContext | null = null;

  public assertOperationallyReady(context: AuthenticatedRequestContext): Promise<void> {
    this.calls += 1;
    this.receivedContext = context;
    return Promise.resolve();
  }
}

function createAuthContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: '10000000-0000-0000-0000-000000000001',
      email: 'merchant@example.test',
      accountType: 'MERCHANT',
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

describe('OperationalReadinessGuard', () => {
  let reflector: Reflector;
  let readinessService: FakeOperationalReadinessService;
  let guard: OperationalReadinessGuard;

  beforeEach(() => {
    reflector = new Reflector();
    readinessService = new FakeOperationalReadinessService();
    guard = new OperationalReadinessGuard(
      reflector,
      readinessService as unknown as OperationalReadinessService,
    );
  });

  it('bypasses readiness for public routes', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === PUBLIC_ROUTE_METADATA) {
        return true;
      }

      return undefined;
    });

    await expect(guard.canActivate(createExecutionContext({ headers: {} }))).resolves.toBe(true);

    expect(readinessService.calls).toBe(0);
  });

  it('does nothing when readiness metadata is absent', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === PUBLIC_ROUTE_METADATA) {
        return false;
      }

      if (metadataKey === OPERATIONAL_READINESS_METADATA) {
        return undefined;
      }

      return undefined;
    });

    await expect(guard.canActivate(createExecutionContext({ headers: {} }))).resolves.toBe(true);

    expect(readinessService.calls).toBe(0);
  });

  it('checks readiness when metadata is present', async () => {
    const authContext = createAuthContext();

    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((metadataKey: unknown) => {
      if (metadataKey === PUBLIC_ROUTE_METADATA) {
        return false;
      }

      if (metadataKey === OPERATIONAL_READINESS_METADATA) {
        return true;
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

    expect(readinessService.calls).toBe(1);
    expect(readinessService.receivedContext).toBe(authContext);
  });
});
