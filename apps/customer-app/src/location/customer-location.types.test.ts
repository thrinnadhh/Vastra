import { customerLocationFailureMessage, parseManualCoordinates } from './customer-location.types';

describe('customer location contract', () => {
  it('parses valid manual coordinates without creating an address', () => {
    expect(parseManualCoordinates('13.6288', '79.4192')).toEqual({
      latitude: 13.6288,
      longitude: 79.4192,
    });
  });

  it.each([
    ['', '79.4192'],
    ['13.6288', ''],
    ['91', '79'],
    ['13', '181'],
    ['north', 'east'],
  ])('rejects invalid coordinates %s / %s', (latitude, longitude) => {
    expect(parseManualCoordinates(latitude, longitude)).toBeNull();
  });

  it('keeps permission, GPS, service-area, and network messages truthful', () => {
    expect(customerLocationFailureMessage('PERMISSION_DENIED')).toContain('permission');
    expect(customerLocationFailureMessage('GPS_DISABLED')).toContain('services');
    expect(customerLocationFailureMessage('OUTSIDE_SERVICE_AREA')).toContain('serviceable');
    expect(customerLocationFailureMessage('UNAVAILABLE')).toContain('connection');
  });
});
