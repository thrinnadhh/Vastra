import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type {
  CustomerCoordinates,
  CustomerLocationPermission,
  CustomerLocationPort,
} from './customer-location.types';

function mapPermission(
  response: Pick<Location.PermissionResponse, 'canAskAgain' | 'status'>,
): CustomerLocationPermission {
  switch (response.status) {
    case Location.PermissionStatus.GRANTED:
      return 'GRANTED';
    case Location.PermissionStatus.DENIED:
      return response.canAskAgain ? 'DENIED' : 'BLOCKED';
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
    return mapPermission(response);
  }

  public async requestForegroundPermission(): Promise<CustomerLocationPermission> {
    const response = await Location.requestForegroundPermissionsAsync();
    return mapPermission(response);
  }

  public openAppSettings(): Promise<void> {
    return Linking.openSettings();
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
