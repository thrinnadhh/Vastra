import * as Location from 'expo-location';

import type {
  CustomerCoordinates,
  CustomerLocationPermission,
  CustomerLocationPort,
} from './customer-location.types';

function mapPermission(status: Location.PermissionStatus): CustomerLocationPermission {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'GRANTED';
    case Location.PermissionStatus.DENIED:
      return 'DENIED';
    case Location.PermissionStatus.UNDETERMINED:
      return 'UNDETERMINED';
  }
}

export class ExpoCustomerLocationAdapter implements CustomerLocationPort {
  public hasServicesEnabled(): Promise<boolean> {
    return Location.hasServicesEnabledAsync();
  }

  public async getForegroundPermission(): Promise<CustomerLocationPermission> {
    const response = await Location.getForegroundPermissionsAsync();
    return mapPermission(response.status);
  }

  public async requestForegroundPermission(): Promise<CustomerLocationPermission> {
    const response = await Location.requestForegroundPermissionsAsync();
    return mapPermission(response.status);
  }

  public async getCurrentCoordinates(): Promise<CustomerCoordinates> {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }
}
