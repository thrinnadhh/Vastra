import type { SupabaseClient } from './supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from './auth.types';
import {
  OperationalReadinessGatewayUnavailableError,
  type OperationalReadinessGateway,
} from './operational-readiness.gateway';
import { OperationalReadinessService } from './operational-readiness.service';
import type {
  CaptainOperationalProfile,
  MerchantOperationalProfile,
} from './operational-readiness.types';

const client = Object.freeze({}) as unknown as SupabaseClient;

class FakeOperationalReadinessGateway implements OperationalReadinessGateway {
  public merchantProfile: MerchantOperationalProfile | null = null;
  public captainProfile: CaptainOperationalProfile | null = null;
  public error: Error | null = null;
  public merchantCalls = 0;
  public captainCalls = 0;
  public receivedClient: SupabaseClient | null = null;
  public receivedUserId: string | null = null;

  public findMerchantOperationalProfile(
    receivedClient: SupabaseClient,
    userId: string,
  ): Promise<MerchantOperationalProfile | null> {
    this.merchantCalls += 1;
    this.receivedClient = receivedClient;
    this.receivedUserId = userId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.merchantProfile);
  }

  public findCaptainOperationalProfile(
    receivedClient: SupabaseClient,
    userId: string,
  ): Promise<CaptainOperationalProfile | null> {
    this.captainCalls += 1;
    this.receivedClient = receivedClient;
    this.receivedUserId = userId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.captainProfile);
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

describe('OperationalReadinessService', () => {
  let gateway: FakeOperationalReadinessGateway;
  let service: OperationalReadinessService;

  beforeEach(() => {
    gateway = new FakeOperationalReadinessGateway();
    service = new OperationalReadinessService(gateway);
  });

  it('allows a fully approved merchant', async () => {
    gateway.merchantProfile = {
      onboardingStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      approvedAt: '2026-07-13T00:00:00.000Z',
    };

    await expect(
      service.assertOperationallyReady(createContext('MERCHANT')),
    ).resolves.toBeUndefined();

    expect(gateway.merchantCalls).toBe(1);
    expect(gateway.captainCalls).toBe(0);
    expect(gateway.receivedClient).toBe(client);
    expect(gateway.receivedUserId).toBe('10000000-0000-0000-0000-000000000001');
  });

  it('keeps an incomplete merchant pending', async () => {
    gateway.merchantProfile = {
      onboardingStatus: 'VERIFICATION_PENDING',
      kycStatus: 'IN_REVIEW',
      approvedAt: null,
    };

    await expect(service.assertOperationallyReady(createContext('MERCHANT'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ACCOUNT_PENDING',
    );
  });

  it('blocks a suspended merchant', async () => {
    gateway.merchantProfile = {
      onboardingStatus: 'SUSPENDED',
      kycStatus: 'VERIFIED',
      approvedAt: '2026-07-13T00:00:00.000Z',
    };

    await expect(service.assertOperationallyReady(createContext('MERCHANT'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ACCOUNT_BLOCKED',
    );
  });

  it('allows an approved offline captain', async () => {
    gateway.captainProfile = {
      kycStatus: 'VERIFIED',
      availabilityStatus: 'OFFLINE',
      approvedAt: '2026-07-13T00:00:00.000Z',
    };

    await expect(
      service.assertOperationallyReady(createContext('CAPTAIN')),
    ).resolves.toBeUndefined();

    expect(gateway.merchantCalls).toBe(0);
    expect(gateway.captainCalls).toBe(1);
  });

  it('keeps an unapproved captain pending', async () => {
    gateway.captainProfile = {
      kycStatus: 'VERIFIED',
      availabilityStatus: 'AVAILABLE',
      approvedAt: null,
    };

    await expect(service.assertOperationallyReady(createContext('CAPTAIN'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ACCOUNT_PENDING',
    );
  });

  it('blocks a suspended captain', async () => {
    gateway.captainProfile = {
      kycStatus: 'VERIFIED',
      availabilityStatus: 'SUSPENDED',
      approvedAt: '2026-07-13T00:00:00.000Z',
    };

    await expect(service.assertOperationallyReady(createContext('CAPTAIN'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ACCOUNT_BLOCKED',
    );
  });

  it('rejects an account type without an operational profile', async () => {
    await expect(service.assertOperationallyReady(createContext('CUSTOMER'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'ACCOUNT_TYPE_FORBIDDEN',
    );

    expect(gateway.merchantCalls).toBe(0);
    expect(gateway.captainCalls).toBe(0);
  });

  it('fails closed when readiness data is unavailable', async () => {
    gateway.error = new OperationalReadinessGatewayUnavailableError();

    await expect(service.assertOperationallyReady(createContext('MERCHANT'))).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
