import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type {
  CustomerCoordinates,
  CustomerLocationPermission,
  CustomerLocationPort,
} from './customer-location.types';

export function mapExpoCustomerLocationPermission(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
): CustomerLocationPermission {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'GRANTED';
    case Location.PermissionStatus.DENIED:
      return canAskAgain ? 'DENIED' : 'BLOCKED';
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
    return mapExpoCustomerLocationPermission(response.status, response.canAskAgain);
  }

  public async requestForegroundPermission(): Promise<CustomerLocationPermission> {
    const response = await Location.requestForegroundPermissionsAsync();
    return mapExpoCustomerLocationPermission(response.status, response.canAskAgain);
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
