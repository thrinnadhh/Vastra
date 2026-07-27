import type { AdminListCursor } from './admin-list.validation';

export const ADMIN_PROFILE_STATUSES = [
  'ACTIVE',
  'PENDING',
  'BLOCKED',
  'SUSPENDED',
  'DELETED',
] as const;
export const ADMIN_MERCHANT_ONBOARDING_STATUSES = [
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
export const ADMIN_KYC_STATUSES = ['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED'] as const;
export const ADMIN_CAPTAIN_AVAILABILITY_STATUSES = [
  'OFFLINE',
  'AVAILABLE',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'DELIVERING',
  'ON_BREAK',
  'SUSPENDED',
] as const;

export interface AdminActorListQuery {
  readonly query: string | null;
  readonly profileStatus: string | null;
  readonly kycStatus: string | null;
  readonly cursor: AdminListCursor | null;
  readonly limit: number;
}

export interface AdminMerchantListQuery extends AdminActorListQuery {
  readonly onboardingStatus: string | null;
}

export interface AdminCaptainListQuery extends AdminActorListQuery {
  readonly availabilityStatus: string | null;
}

export interface AdminMerchantListItem {
  readonly id: string;
  readonly fullName: string;
  readonly legalName: string;
  readonly phoneLast4: string | null;
  readonly profileStatus: string;
  readonly onboardingStatus: string;
  readonly kycStatus: string;
  readonly shopCount: number;
  readonly openOrders: number;
  readonly problemOrders30d: number;
  readonly updatedAt: string;
}

export interface AdminCaptainListItem {
  readonly id: string;
  readonly captainCode: string;
  readonly fullName: string;
  readonly phoneLast4: string | null;
  readonly profileStatus: string;
  readonly kycStatus: string;
  readonly availabilityStatus: string;
  readonly vehicleType: string | null;
  readonly ratingAverage: number | null;
  readonly completedDeliveries: number;
  readonly activeDeliveryTaskId: string | null;
  readonly locationRecordedAt: string | null;
  readonly problemDeliveries30d: number;
  readonly updatedAt: string;
}

export interface AdminMerchantListPage {
  readonly items: readonly AdminMerchantListItem[];
  readonly nextCursor: AdminListCursor | null;
}

export interface AdminCaptainListPage {
  readonly items: readonly AdminCaptainListItem[];
  readonly nextCursor: AdminListCursor | null;
}

export interface ListAdminMerchantsResponse {
  readonly success: true;
  readonly data: {
    readonly merchants: readonly AdminMerchantListItem[];
    readonly nextCursor: string | null;
  };
  readonly meta: { readonly requestId: null };
}

export interface ListAdminCaptainsResponse {
  readonly success: true;
  readonly data: {
    readonly captains: readonly AdminCaptainListItem[];
    readonly nextCursor: string | null;
  };
  readonly meta: { readonly requestId: null };
}
