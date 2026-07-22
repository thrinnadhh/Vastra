import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerProfileGateway,
  CustomerProfileGatewayUnavailableError,
  CustomerProfileStateInvalidError,
} from './customer-profile.gateway';
import { CustomerProfileService } from './customer-profile.service';
import type { CustomerProfileUpdateSnapshot } from './customer-profile.types';
import type { MeService } from './me.service';
import type { GetCurrentAccountResponse } from './me.types';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const context: AuthenticatedRequestContext = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'test-token',
  supabase: emptySupabaseClient,
};

const accountResponse: GetCurrentAccountResponse = {
  success: true,
  data: {
    id: context.actor.id,
    email: context.actor.email,
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
    profile: {
      fullName: 'Trinadh B',
      phoneNumber: '+919999999999',
      avatarUrl: null,
    },
    roleProfile: {
      kind: 'CUSTOMER',
      dateOfBirth: null,
      genderPreference: null,
      profileCompleted: true,
      defaultAddressId: null,
    },
    scope: { kind: 'CUSTOMER' },
  },
  meta: { requestId: null },
};

class RecordingCustomerProfileGateway implements CustomerProfileGateway {
  public inputs: string[] = [];
  public error: Error | null = null;

  public updateCurrentCustomerProfile(
    _client: SupabaseClient,
    input: { readonly fullName: string },
  ): Promise<CustomerProfileUpdateSnapshot> {
    this.inputs.push(input.fullName);
    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve({
      fullName: input.fullName,
      profileCompleted: true,
      updatedAt: '2026-07-22T04:00:00.000Z',
    });
  }
}

function errorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response = error.getResponse() as { readonly error?: { readonly code?: unknown } };
  if (typeof response.error?.code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return response.error.code;
}

describe('CustomerProfileService', () => {
  let gateway: RecordingCustomerProfileGateway;
  let currentAccountReads: number;
  let service: CustomerProfileService;

  beforeEach(() => {
    gateway = new RecordingCustomerProfileGateway();
    currentAccountReads = 0;
    const meService = {
      getCurrentAccount: () => {
        currentAccountReads += 1;
        return Promise.resolve(accountResponse);
      },
    } as unknown as MeService;
    service = new CustomerProfileService(gateway, meService);
  });

  it('updates the profile and returns the authoritative current account', async () => {
    await expect(
      service.updateCurrentCustomerProfile(context, { fullName: '  Trinadh B ' }),
    ).resolves.toStrictEqual(accountResponse);
    expect(gateway.inputs).toStrictEqual(['Trinadh B']);
    expect(currentAccountReads).toBe(1);
  });

  it('rejects invalid input before calling the gateway', async () => {
    await expect(
      service.updateCurrentCustomerProfile(context, { fullName: ' ' }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'VALIDATION_ERROR');
    expect(gateway.inputs).toStrictEqual([]);
    expect(currentAccountReads).toBe(0);
  });

  it('maps invalid profile state without reading the account again', async () => {
    gateway.error = new CustomerProfileStateInvalidError();
    await expect(
      service.updateCurrentCustomerProfile(context, { fullName: 'Trinadh B' }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'PROFILE_STATE_INVALID');
    expect(currentAccountReads).toBe(0);
  });

  it('maps provider failures as retryable service unavailability', async () => {
    gateway.error = new CustomerProfileGatewayUnavailableError();
    await expect(
      service.updateCurrentCustomerProfile(context, { fullName: 'Trinadh B' }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
