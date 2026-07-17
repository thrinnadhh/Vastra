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
export type CaptainRequestedAvailabilityStatus = 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK';

export interface CaptainLocationSample {
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

export interface CaptainAvailabilityResult {
  readonly availabilityStatus: CaptainAvailabilityStatus;
  readonly dispatchEligible: boolean;
  readonly changed: boolean;
  readonly locationFresh: boolean | null;
  readonly locationRecordedAt: string | null;
}

export interface CaptainLocationResult {
  readonly sampleId: string;
  readonly acceptedAt: string;
  readonly replayed: boolean;
}

export interface CaptainPresencePort {
  getAvailability(): Promise<CaptainAvailabilityStatus>;
  setAvailability(status: CaptainRequestedAvailabilityStatus): Promise<CaptainAvailabilityResult>;
  updateLocation(sample: CaptainLocationSample): Promise<CaptainLocationResult>;
}

export interface CaptainLocationPermissionResult {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

export interface CaptainLocationProvider {
  requestForegroundPermission(): Promise<CaptainLocationPermissionResult>;
  getCurrentLocation(): Promise<CaptainLocationSample>;
  watchLocations(listener: (sample: CaptainLocationSample) => void): Promise<() => void>;
}
