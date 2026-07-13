export const MERCHANT_ONBOARDING_STATUSES = [
  'STARTED',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'CORRECTION_REQUIRED',
  'APPROVED',
  'CATALOGUE_SETUP',
  'TRAINING_PENDING',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'REJECTED',
] as const;

export type MerchantOnboardingStatus = (typeof MERCHANT_ONBOARDING_STATUSES)[number];

export const KYC_STATUSES = ['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED'] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];

export const CAPTAIN_AVAILABILITY_STATUSES = [
  'OFFLINE',
  'AVAILABLE',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'DELIVERING',
  'ON_BREAK',
  'SUSPENDED',
] as const;

export type CaptainAvailabilityStatus = (typeof CAPTAIN_AVAILABILITY_STATUSES)[number];

export interface MerchantOperationalProfile {
  readonly onboardingStatus: MerchantOnboardingStatus;
  readonly kycStatus: KycStatus;
  readonly approvedAt: string | null;
}

export interface CaptainOperationalProfile {
  readonly kycStatus: KycStatus;
  readonly availabilityStatus: CaptainAvailabilityStatus;
  readonly approvedAt: string | null;
}
