import type { CaptainAvailabilityStatus } from '../auth/operational-readiness.types';

export const CAPTAIN_CLIENT_AVAILABILITY_STATUSES = [
  'OFFLINE',
  'AVAILABLE',
  'ON_BREAK',
] as const;

export type CaptainClientAvailabilityStatus =
  (typeof CAPTAIN_CLIENT_AVAILABILITY_STATUSES)[number];

export interface SetCaptainAvailabilityCommand {
  readonly actorId: string;
  readonly requestedStatus: CaptainClientAvailabilityStatus;
}

export interface CaptainAvailabilityLocationSnapshot {
  readonly recordedAt: string;
  readonly accuracyMeters: number;
  readonly fresh: boolean;
  readonly activeDeliveryTaskId: string | null;
}

export interface CaptainAvailabilitySnapshot {
  readonly captainId: string;
  readonly requestedStatus: CaptainClientAvailabilityStatus;
  readonly availabilityStatus: CaptainAvailabilityStatus;
  readonly changed: boolean;
  readonly dispatchEligible: boolean;
  readonly location: CaptainAvailabilityLocationSnapshot | null;
  readonly changedAt: string;
}

export interface UpdateCaptainLocationCommand {
  readonly actorId: string;
  readonly sampleId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly recordedAt: string;
  readonly heading: number | null;
  readonly speedMps: number | null;
  readonly batteryPercent: number | null;
  readonly activeDeliveryTaskId: string | null;
}

export interface CaptainLocationSnapshot {
  readonly captainId: string;
  readonly sampleId: string;
  readonly recordedAt: string;
  readonly acceptedAt: string;
  readonly accuracyMeters: number;
  readonly activeDeliveryTaskId: string | null;
  readonly historySampled: boolean;
  readonly replayed: boolean;
}

export interface CaptainAvailabilityResponse {
  readonly success: true;
  readonly data: {
    readonly availability: CaptainAvailabilitySnapshot;
  };
  readonly meta: {
    readonly requestId: null;
  };
}

export interface CaptainLocationResponse {
  readonly success: true;
  readonly data: {
    readonly location: CaptainLocationSnapshot;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
