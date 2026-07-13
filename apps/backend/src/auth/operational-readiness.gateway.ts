import type { SupabaseClient } from './supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  CAPTAIN_AVAILABILITY_STATUSES,
  KYC_STATUSES,
  MERCHANT_ONBOARDING_STATUSES,
  type CaptainAvailabilityStatus,
  type CaptainOperationalProfile,
  type KycStatus,
  type MerchantOnboardingStatus,
  type MerchantOperationalProfile,
} from './operational-readiness.types';

export interface OperationalReadinessGateway {
  findMerchantOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<MerchantOperationalProfile | null>;

  findCaptainOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CaptainOperationalProfile | null>;
}

export class OperationalReadinessGatewayUnavailableError extends Error {
  public constructor() {
    super('Operational readiness provider unavailable');
    this.name = 'OperationalReadinessGatewayUnavailableError';
  }
}

export class OperationalReadinessDataInvalidError extends Error {
  public constructor() {
    super('Operational readiness data is invalid');
    this.name = 'OperationalReadinessDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMerchantOnboardingStatus(value: unknown): value is MerchantOnboardingStatus {
  return (
    typeof value === 'string' &&
    MERCHANT_ONBOARDING_STATUSES.some((candidate) => candidate === value)
  );
}

function isKycStatus(value: unknown): value is KycStatus {
  return typeof value === 'string' && KYC_STATUSES.some((candidate) => candidate === value);
}

function isCaptainAvailabilityStatus(value: unknown): value is CaptainAvailabilityStatus {
  return (
    typeof value === 'string' &&
    CAPTAIN_AVAILABILITY_STATUSES.some((candidate) => candidate === value)
  );
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OperationalReadinessDataInvalidError();
  }

  return value;
}

function parseMerchantOperationalProfile(value: unknown): MerchantOperationalProfile | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new OperationalReadinessDataInvalidError();
  }

  const onboardingStatus = value['onboarding_status'];
  const kycStatus = value['kyc_status'];

  if (!isMerchantOnboardingStatus(onboardingStatus) || !isKycStatus(kycStatus)) {
    throw new OperationalReadinessDataInvalidError();
  }

  return {
    onboardingStatus,
    kycStatus,
    approvedAt: requireNullableString(value, 'approved_at'),
  };
}

function parseCaptainOperationalProfile(value: unknown): CaptainOperationalProfile | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new OperationalReadinessDataInvalidError();
  }

  const kycStatus = value['kyc_status'];
  const availabilityStatus = value['availability_status'];

  if (!isKycStatus(kycStatus) || !isCaptainAvailabilityStatus(availabilityStatus)) {
    throw new OperationalReadinessDataInvalidError();
  }

  return {
    kycStatus,
    availabilityStatus,
    approvedAt: requireNullableString(value, 'approved_at'),
  };
}

function rethrowOperationalReadinessError(error: unknown): never {
  if (
    error instanceof OperationalReadinessGatewayUnavailableError ||
    error instanceof OperationalReadinessDataInvalidError
  ) {
    throw error;
  }

  throw new OperationalReadinessGatewayUnavailableError();
}

@Injectable()
export class SupabaseOperationalReadinessGateway implements OperationalReadinessGateway {
  public async findMerchantOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<MerchantOperationalProfile | null> {
    try {
      const response = await client
        .from('merchant_profiles')
        .select('onboarding_status, kyc_status, approved_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new OperationalReadinessGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseMerchantOperationalProfile(data);
    } catch (error: unknown) {
      return rethrowOperationalReadinessError(error);
    }
  }

  public async findCaptainOperationalProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<CaptainOperationalProfile | null> {
    try {
      const response = await client
        .from('captain_profiles')
        .select('kyc_status, availability_status, approved_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new OperationalReadinessGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseCaptainOperationalProfile(data);
    } catch (error: unknown) {
      return rethrowOperationalReadinessError(error);
    }
  }
}
