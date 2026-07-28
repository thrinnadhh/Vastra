import type { AdminMutationReasonCode } from './admin.types';

export const MARKET_LIFECYCLE_STATUSES = [
  'DRAFT',
  'CONFIGURING',
  'READY_FOR_VALIDATION',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
] as const;

export type MarketLifecycleStatus = (typeof MARKET_LIFECYCLE_STATUSES)[number];

export interface AdminCity {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly stateCode: string;
  readonly countryCode: string;
  readonly status: MarketLifecycleStatus;
  readonly activatedAt: string | null;
  readonly pausedAt: string | null;
  readonly closedAt: string | null;
  readonly updatedAt: string;
}

export interface AdminCityConfiguration {
  readonly cityId: string;
  readonly timezone: string;
  readonly defaultCodLimitPaise: number;
  readonly defaultDeliveryRadiusMeters: number;
  readonly maximumDeliveryRadiusMeters: number;
  readonly baseDeliveryFeePaise: number;
  readonly perKmDeliveryFeePaise: number;
  readonly merchantCommissionBps: number;
  readonly localDeliveryEnabled: boolean;
  readonly postalDeliveryEnabled: boolean;
  readonly operatingHours: Readonly<Record<string, unknown>>;
  readonly holidayDates: readonly string[];
  readonly cancellationPolicy: Readonly<Record<string, unknown>>;
  readonly refundPolicy: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AdminCityReadiness {
  readonly cityId: string;
  readonly activeCaptainCount: number;
  readonly standbyCaptainCount: number;
  readonly paymentProviderHealthy: boolean;
  readonly smsOtpProviderHealthy: boolean;
  readonly fcmProviderHealthy: boolean;
  readonly observabilityHealthy: boolean;
  readonly validationOrderId: string | null;
  readonly unresolvedHighBlockers: number;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AdminServiceZonePincode {
  readonly id: string;
  readonly cityId: string;
  readonly serviceZoneId: string;
  readonly pincode: string;
  readonly priority: number;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AdminServiceZone {
  readonly id: string;
  readonly cityId: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly status: MarketLifecycleStatus;
  readonly defaultDeliveryRadiusMeters: number | null;
  readonly version: number;
  readonly updatedAt: string;
  readonly pincodes: readonly AdminServiceZonePincode[];
}

export interface AdminCityPreflightReport {
  readonly id: string;
  readonly cityId: string;
  readonly cityConfigurationVersion: number;
  readonly readinessVersion: number;
  readonly cityStatus: MarketLifecycleStatus;
  readonly checks: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly passed: boolean;
  readonly createdAt: string;
}

export interface AdminCityControlPlane {
  readonly city: AdminCity;
  readonly configuration: AdminCityConfiguration;
  readonly readiness: AdminCityReadiness;
  readonly zones: readonly AdminServiceZone[];
  readonly latestPreflight: AdminCityPreflightReport | null;
}

export interface AdminCityMutationResult {
  readonly replayed: boolean;
  readonly controlPlane: AdminCityControlPlane;
}

export interface AdminCityPreflightResult {
  readonly replayed: boolean;
  readonly report: AdminCityPreflightReport;
}

export interface AdminMutationMetadata {
  readonly actorId: string;
  readonly cityId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminUpdateCityConfigurationInput extends AdminMutationMetadata {
  readonly expectedVersion: number;
  readonly patch: Readonly<Record<string, unknown>>;
}

export interface AdminUpsertServiceZoneInput extends AdminMutationMetadata {
  readonly zoneId: string | null;
  readonly expectedVersion: number | null;
  readonly patch: Readonly<Record<string, unknown>>;
}

export interface AdminUpsertServiceZonePincodeInput extends AdminMutationMetadata {
  readonly zoneId: string;
  readonly mappingId: string | null;
  readonly expectedVersion: number | null;
  readonly pincode: string;
  readonly priority: number;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
}

export interface AdminUpdateCityReadinessInput extends AdminMutationMetadata {
  readonly expectedVersion: number;
  readonly readiness: Readonly<Record<string, unknown>>;
}

export type AdminRunCityPreflightInput = AdminMutationMetadata;

export interface AdminTransitionCityInput extends AdminMutationMetadata {
  readonly targetStatus: 'ACTIVE' | 'PAUSED';
}
