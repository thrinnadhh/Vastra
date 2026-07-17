import * as Location from 'expo-location';

import type {
  CaptainLocationPermissionResult,
  CaptainLocationProvider,
  CaptainLocationSample,
} from './captain-presence.types';

function createSampleId(): string {
  const bytes = new Uint8Array(16);
  const cryptoObject = globalThis.crypto;

  if (cryptoObject?.getRandomValues !== undefined) {
    cryptoObject.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapLocation(location: Location.LocationObject): CaptainLocationSample {
  return {
    sampleId: createSampleId(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? 999,
    recordedAt: new Date(location.timestamp).toISOString(),
    heading: location.coords.heading ?? null,
    speedMps: location.coords.speed ?? null,
    batteryPercent: null,
    activeDeliveryTaskId: null,
  };
}

export class ExpoCaptainLocationProvider implements CaptainLocationProvider {
  public async requestForegroundPermission(): Promise<CaptainLocationPermissionResult> {
    const result = await Location.requestForegroundPermissionsAsync();

    return {
      granted: result.granted,
      canAskAgain: result.canAskAgain,
    };
  }

  public async getCurrentLocation(): Promise<CaptainLocationSample> {
    return mapLocation(
      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
    );
  }

  public async watchLocations(
    listener: (sample: CaptainLocationSample) => void,
  ): Promise<() => void> {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 25,
      },
      (location) => {
        listener(mapLocation(location));
      },
    );

    return () => {
      subscription.remove();
    };
  }
}
