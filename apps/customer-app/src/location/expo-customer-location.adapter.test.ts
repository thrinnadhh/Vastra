import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { ExpoCustomerLocationAdapter } from './expo-customer-location.adapter';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const permissionResponse = (status: string, canAskAgain: boolean) => ({
  status,
  canAskAgain,
  granted: status === Location.PermissionStatus.GRANTED,
  expires: 'never',
});

describe('ExpoCustomerLocationAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('distinguishes retryable denial from a permanently blocked permission', async () => {
    const permission = Location.getForegroundPermissionsAsync as jest.Mock;
    permission
      .mockResolvedValueOnce(permissionResponse(Location.PermissionStatus.DENIED, true))
      .mockResolvedValueOnce(permissionResponse(Location.PermissionStatus.DENIED, false));
    const adapter = new ExpoCustomerLocationAdapter();

    await expect(adapter.getForegroundPermission()).resolves.toBe('DENIED');
    await expect(adapter.getForegroundPermission()).resolves.toBe('BLOCKED');
  });

  it('maps granted and undetermined permission responses', async () => {
    const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
    requestPermission
      .mockResolvedValueOnce(permissionResponse(Location.PermissionStatus.GRANTED, true))
      .mockResolvedValueOnce(permissionResponse(Location.PermissionStatus.UNDETERMINED, true));
    const adapter = new ExpoCustomerLocationAdapter();

    await expect(adapter.requestForegroundPermission()).resolves.toBe('GRANTED');
    await expect(adapter.requestForegroundPermission()).resolves.toBe('UNDETERMINED');
  });

  it('opens native application settings for blocked-permission recovery', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await new ExpoCustomerLocationAdapter().openAppSettings();

    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
