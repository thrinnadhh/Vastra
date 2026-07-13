import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  ACCOUNT_TYPES,
  PROFILE_STATUSES,
  type AccountType,
  type ProfileStatus,
} from '../auth/auth.types';
import type {
  AdminProfileSnapshot,
  CaptainProfileSnapshot,
  CommonProfileSnapshot,
  CustomerProfileSnapshot,
  MerchantProfileSnapshot,
  MerchantShopSnapshot,
} from './me.types';

export interface MeGateway {
  findCommonProfile(client: SupabaseClient, userId: string): Promise<CommonProfileSnapshot | null>;

  findCustomerProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CustomerProfileSnapshot | null>;

  findMerchantProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<MerchantProfileSnapshot | null>;

  findMerchantShops(
    client: SupabaseClient,
    userId: string,
  ): Promise<readonly MerchantShopSnapshot[]>;

  findCaptainProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CaptainProfileSnapshot | null>;

  findAdminProfile(client: SupabaseClient, userId: string): Promise<AdminProfileSnapshot | null>;
}

export class MeGatewayUnavailableError extends Error {
  public constructor() {
    super('Me data provider unavailable');
    this.name = 'MeGatewayUnavailableError';
  }
}

export class MeProfileDataInvalidError extends Error {
  public constructor() {
    super('Me profile data invalid');
    this.name = 'MeProfileDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && ACCOUNT_TYPES.some((candidate) => candidate === value);
}

function isProfileStatus(value: unknown): value is ProfileStatus {
  return typeof value === 'string' && PROFILE_STATUSES.some((candidate) => candidate === value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MeProfileDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MeProfileDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MeProfileDataInvalidError();
  }

  return value;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new MeProfileDataInvalidError();
}

function requireNullableFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  if (record[key] === null) {
    return null;
  }

  return requireFiniteNumber(record, key);
}

function requireSafeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireFiniteNumber(record, key);

  if (!Number.isSafeInteger(value)) {
    throw new MeProfileDataInvalidError();
  }

  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new MeProfileDataInvalidError();
  }

  return value;
}

function parseCommonProfile(value: unknown): CommonProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  const accountType = value['account_type'];
  const status = value['status'];

  if (!isAccountType(accountType) || !isProfileStatus(status)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    accountType,
    fullName: requireNullableString(value, 'full_name'),
    phoneNumber: requireNullableString(value, 'phone_number'),
    avatarUrl: requireNullableString(value, 'avatar_url'),
    status,
  };
}

function parseCustomerProfile(value: unknown): CustomerProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    dateOfBirth: requireNullableString(value, 'date_of_birth'),
    genderPreference: requireNullableString(value, 'gender_preference'),
    profileCompleted: requireBoolean(value, 'profile_completed'),
    defaultAddressId: requireNullableString(value, 'default_address_id'),
  };
}

function parseMerchantProfile(value: unknown): MerchantProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    legalName: requireString(value, 'legal_name'),
    businessType: requireNullableString(value, 'business_type'),
    onboardingStatus: requireString(value, 'onboarding_status'),
    kycStatus: requireString(value, 'kyc_status'),
    approvedAt: requireNullableString(value, 'approved_at'),
  };
}

function parseMerchantShop(value: unknown): MerchantShopSnapshot {
  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopCode: requireString(value, 'shop_code'),
    name: requireString(value, 'name'),
    verificationStatus: requireString(value, 'verification_status'),
    operationalStatus: requireString(value, 'operational_status'),
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
  };
}

function parseMerchantShops(value: unknown): readonly MerchantShopSnapshot[] {
  if (!Array.isArray(value)) {
    throw new MeProfileDataInvalidError();
  }

  return value.map((shop) => parseMerchantShop(shop));
}

function parseCaptainProfile(value: unknown): CaptainProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    captainCode: requireString(value, 'captain_code'),
    kycStatus: requireString(value, 'kyc_status'),
    availabilityStatus: requireString(value, 'availability_status'),
    vehicleType: requireNullableString(value, 'vehicle_type'),
    vehicleNumber: requireNullableString(value, 'vehicle_number'),
    ratingAverage: requireNullableFiniteNumber(value, 'rating_average'),
    ratingCount: requireSafeInteger(value, 'rating_count'),
    completedDeliveries: requireSafeInteger(value, 'completed_deliveries'),
    cashBalancePaise: requireSafeInteger(value, 'cash_balance_paise'),
    approvedAt: requireNullableString(value, 'approved_at'),
  };
}

function parseAdminProfile(value: unknown): AdminProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new MeProfileDataInvalidError();
  }

  return {
    employeeCode: requireString(value, 'employee_code'),
    department: requireString(value, 'department'),
    cityScope: requireStringArray(value, 'city_scope'),
    managerId: requireNullableString(value, 'manager_id'),
    twoFactorEnabled: requireBoolean(value, 'two_factor_enabled'),
  };
}

function rethrowGatewayError(error: unknown): never {
  if (error instanceof MeGatewayUnavailableError || error instanceof MeProfileDataInvalidError) {
    throw error;
  }

  throw new MeGatewayUnavailableError();
}

@Injectable()
export class SupabaseMeGateway implements MeGateway {
  public async findCommonProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CommonProfileSnapshot | null> {
    try {
      const response = await client
        .from('profiles')
        .select('id, account_type, full_name, phone_number, avatar_url, status')
        .eq('id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseCommonProfile(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findCustomerProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CustomerProfileSnapshot | null> {
    try {
      const response = await client
        .from('customer_profiles')
        .select('date_of_birth, gender_preference, profile_completed, default_address_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseCustomerProfile(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findMerchantProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<MerchantProfileSnapshot | null> {
    try {
      const response = await client
        .from('merchant_profiles')
        .select('legal_name, business_type, onboarding_status, kyc_status, approved_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseMerchantProfile(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findMerchantShops(
    client: SupabaseClient,
    userId: string,
  ): Promise<readonly MerchantShopSnapshot[]> {
    try {
      const response = await client
        .from('shops')
        .select(
          'id, shop_code, name, verification_status, operational_status, accepts_online_orders, created_at',
        )
        .eq('merchant_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseMerchantShops(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findCaptainProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CaptainProfileSnapshot | null> {
    try {
      const response = await client
        .from('captain_profiles')
        .select(
          [
            'captain_code',
            'kyc_status',
            'availability_status',
            'vehicle_type',
            'vehicle_number',
            'rating_average',
            'rating_count',
            'completed_deliveries',
            'cash_balance_paise',
            'approved_at',
          ].join(', '),
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseCaptainProfile(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findAdminProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<AdminProfileSnapshot | null> {
    try {
      const response = await client
        .from('admin_profiles')
        .select('employee_code, department, city_scope, manager_id, two_factor_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MeGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseAdminProfile(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
