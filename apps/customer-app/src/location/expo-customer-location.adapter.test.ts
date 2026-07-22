import * as Location from 'expo-location';

import { mapExpoCustomerLocationPermission } from './expo-customer-location.adapter';

describe('mapExpoCustomerLocationPermission', () => {
  it.each([
    [Location.PermissionStatus.GRANTED, true, 'GRANTED'],
    [Location.PermissionStatus.DENIED, true, 'DENIED'],
    [Location.PermissionStatus.DENIED, false, 'BLOCKED'],
    [Location.PermissionStatus.UNDETERMINED, true, 'UNDETERMINED'],
  ] as const)('maps %s with canAskAgain=%s to %s', (status, canAskAgain, expected) => {
    expect(mapExpoCustomerLocationPermission(status, canAskAgain)).toBe(expected);
  });
});
