import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AccountType, AuthenticatedRequestContext } from '../auth/auth.types';
import { type MeGateway, MeGatewayUnavailableError } from './me.gateway';
import { MeService } from './me.service';
import type {
  AdminProfileSnapshot,
  CaptainProfileSnapshot,
  CommonProfileSnapshot,
  CustomerProfileSnapshot,
  MerchantProfileSnapshot,
  MerchantShopSnapshot,
} from './me.types';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const USER_ID = '10000000-0000-0000-0000-000000000001';

function createContext(accountType: AccountType): AuthenticatedRequestContext {
  return {
    actor: {
      id: USER_ID,
      email: 'user@example.test',
      accountType,
      status: 'ACTIVE',
    },
    accessToken: 'test-token',
    supabase: emptySupabaseClient,
  };
}

function createCommonProfile(accountType: AccountType): CommonProfileSnapshot {
  return {
    id: USER_ID,
    accountType,
    fullName: 'Vastra User',
    phoneNumber: '+919999999999',
    avatarUrl: null,
    status: 'ACTIVE',
  };
}

class RecordingMeGateway implements MeGateway {
  public calls: string[] = [];
  public commonProfile: CommonProfileSnapshot | null = createCommonProfile('CUSTOMER');
  public customerProfile: CustomerProfileSnapshot | null = {
    dateOfBirth: '1998-01-01',
    genderPreference: 'MENSWEAR',
    profileCompleted: true,
    defaultAddressId: null,
  };
  public merchantProfile: MerchantProfileSnapshot | null = {
    legalName: 'Vastra Store',
    businessType: 'PROPRIETORSHIP',
    onboardingStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    approvedAt: '2026-07-13T00:00:00.000Z',
  };
  public merchantShops: readonly MerchantShopSnapshot[] = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      shopCode: 'VAS001',
      name: 'Vastra Store',
      verificationStatus: 'VERIFIED',
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
    },
  ];
  public captainProfile: CaptainProfileSnapshot | null = {
    captainCode: 'CAP001',
    kycStatus: 'VERIFIED',
    availabilityStatus: 'AVAILABLE',
    vehicleType: 'BIKE',
    vehicleNumber: 'AP00AA0000',
    ratingAverage: 4.8,
    ratingCount: 10,
    completedDeliveries: 25,
    cashBalancePaise: 1000,
    approvedAt: '2026-07-13T00:00:00.000Z',
  };
  public adminProfile: AdminProfileSnapshot | null = {
    employeeCode: 'ADM001',
    department: 'OPERATIONS',
    cityScope: ['Tirupati'],
    managerId: null,
    twoFactorEnabled: true,
  };
  public unavailable = false;

  public findCommonProfile(): Promise<CommonProfileSnapshot | null> {
    this.calls.push('profiles');

    if (this.unavailable) {
      return Promise.reject(new MeGatewayUnavailableError());
    }

    return Promise.resolve(this.commonProfile);
  }

  public findCustomerProfile(): Promise<CustomerProfileSnapshot | null> {
    this.calls.push('customer_profiles');
    return Promise.resolve(this.customerProfile);
  }

  public findMerchantProfile(): Promise<MerchantProfileSnapshot | null> {
    this.calls.push('merchant_profiles');
    return Promise.resolve(this.merchantProfile);
  }

  public findMerchantShops(): Promise<readonly MerchantShopSnapshot[]> {
    this.calls.push('shops');
    return Promise.resolve(this.merchantShops);
  }

  public findCaptainProfile(): Promise<CaptainProfileSnapshot | null> {
    this.calls.push('captain_profiles');
    return Promise.resolve(this.captainProfile);
  }

  public findAdminProfile(): Promise<AdminProfileSnapshot | null> {
    this.calls.push('admin_profiles');
    return Promise.resolve(this.adminProfile);
  }
}

function requireHttpErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected object response');
  }

  const errorValue = (response as Record<string, unknown>)['error'];

  if (typeof errorValue !== 'object' || errorValue === null || Array.isArray(errorValue)) {
    throw new TypeError('Expected error object');
  }

  const code = (errorValue as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected string error code');
  }

  return code;
}

describe('MeService', () => {
  let gateway: RecordingMeGateway;
  let service: MeService;

  beforeEach(() => {
    gateway = new RecordingMeGateway();
    service = new MeService(gateway);
  });

  it('returns the customer account and queries only customer profile data', async () => {
    gateway.commonProfile = createCommonProfile('CUSTOMER');

    const response = await service.getCurrentAccount(createContext('CUSTOMER'));

    expect(response.data.accountType).toBe('CUSTOMER');
    expect(response.data.roleProfile.kind).toBe('CUSTOMER');
    expect(response.data.scope).toStrictEqual({ kind: 'CUSTOMER' });
    expect(gateway.calls).toStrictEqual(['profiles', 'customer_profiles']);
  });

  it('returns the merchant account and owned shop scope', async () => {
    gateway.commonProfile = createCommonProfile('MERCHANT');

    const response = await service.getCurrentAccount(createContext('MERCHANT'));

    expect(response.data.accountType).toBe('MERCHANT');

    if (response.data.accountType !== 'MERCHANT') {
      throw new TypeError('Expected merchant response');
    }

    expect(response.data.scope.shops).toStrictEqual(gateway.merchantShops);
    expect(gateway.calls).toStrictEqual(['profiles', 'merchant_profiles', 'shops']);

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('pan_');
    expect(serialized).not.toContain('gst_number');
    expect(serialized).not.toContain('accessToken');
  });

  it('returns the captain account and current availability scope', async () => {
    gateway.commonProfile = createCommonProfile('CAPTAIN');

    const response = await service.getCurrentAccount(createContext('CAPTAIN'));

    expect(response.data.accountType).toBe('CAPTAIN');

    if (response.data.accountType !== 'CAPTAIN') {
      throw new TypeError('Expected captain response');
    }

    expect(response.data.scope).toStrictEqual({
      kind: 'CAPTAIN',
      captainCode: 'CAP001',
      availabilityStatus: 'AVAILABLE',
    });
    expect(gateway.calls).toStrictEqual(['profiles', 'captain_profiles']);

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('driving_licence');
    expect(serialized).not.toContain('accessToken');
  });

  it('returns the admin account and city scope', async () => {
    gateway.commonProfile = createCommonProfile('ADMIN');

    const response = await service.getCurrentAccount(createContext('ADMIN'));

    expect(response.data.accountType).toBe('ADMIN');

    if (response.data.accountType !== 'ADMIN') {
      throw new TypeError('Expected admin response');
    }

    expect(response.data.scope).toStrictEqual({
      kind: 'ADMIN',
      department: 'OPERATIONS',
      cityScope: ['Tirupati'],
    });
    expect(gateway.calls).toStrictEqual(['profiles', 'admin_profiles']);
  });

  it('maps provider failures to the standardized 503 error', async () => {
    gateway.unavailable = true;

    await expect(service.getCurrentAccount(createContext('CUSTOMER'))).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });

  it('rejects a missing role-specific profile as invalid profile state', async () => {
    gateway.commonProfile = createCommonProfile('CUSTOMER');
    gateway.customerProfile = null;

    await expect(service.getCurrentAccount(createContext('CUSTOMER'))).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'PROFILE_STATE_INVALID',
    );
  });

  it('rejects a common profile that does not match the authenticated actor', async () => {
    gateway.commonProfile = createCommonProfile('MERCHANT');

    await expect(service.getCurrentAccount(createContext('CUSTOMER'))).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'PROFILE_STATE_INVALID',
    );

    expect(gateway.calls).toStrictEqual(['profiles']);
  });
});
