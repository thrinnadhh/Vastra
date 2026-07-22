export interface CustomerCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export type CustomerLocationPermission = 'GRANTED' | 'DENIED' | 'BLOCKED' | 'UNDETERMINED';

export interface CustomerLocationPort {
  hasServicesEnabled(): Promise<boolean>;
  getForegroundPermission(): Promise<CustomerLocationPermission>;
  requestForegroundPermission(): Promise<CustomerLocationPermission>;
  getCurrentCoordinates(): Promise<CustomerCoordinates>;
}

export type CustomerServiceabilityResult =
  | {
      readonly kind: 'SERVICEABLE';
      readonly nearbyShopCount: number;
    }
  | {
      readonly kind: 'OUTSIDE_SERVICE_AREA';
    }
  | {
      readonly kind: 'UNAVAILABLE';
    };

export interface CustomerServiceabilityPort {
  checkLocation(coordinates: CustomerCoordinates): Promise<CustomerServiceabilityResult>;
}

export type CustomerLocationFailureKind =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_BLOCKED'
  | 'GPS_DISABLED'
  | 'INVALID_MANUAL_LOCATION'
  | 'OUTSIDE_SERVICE_AREA'
  | 'UNAVAILABLE';

export function parseManualCoordinates(
  latitudeInput: string,
  longitudeInput: string,
): CustomerCoordinates | null {
  const latitude = Number(latitudeInput.trim());
  const longitude = Number(longitudeInput.trim());

  if (
    latitudeInput.trim().length === 0 ||
    longitudeInput.trim().length === 0 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function customerLocationFailureMessage(kind: CustomerLocationFailureKind): string {
  switch (kind) {
    case 'PERMISSION_DENIED':
      return 'Location permission was denied. Try again or enter your area manually.';
    case 'PERMISSION_BLOCKED':
      return 'Location permission is blocked. Enable it in device settings or enter your area manually.';
    case 'GPS_DISABLED':
      return 'Device location services are off. Turn them on or enter your area manually.';
    case 'INVALID_MANUAL_LOCATION':
      return 'Enter valid latitude and longitude values for your current area.';
    case 'OUTSIDE_SERVICE_AREA':
      return 'Vastra does not yet have a serviceable local shop at this location.';
    case 'UNAVAILABLE':
      return 'We could not verify this location. Check your connection and try again.';
  }
}
