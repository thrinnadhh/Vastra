import { fireEvent, render } from '@testing-library/react-native';

import { CustomerLocationScreen } from './customer-location.screen';
import type {
  CustomerCoordinates,
  CustomerLocationPermission,
  CustomerLocationPort,
  CustomerServiceabilityPort,
  CustomerServiceabilityResult,
} from './customer-location.types';

class LocationPortStub implements CustomerLocationPort {
  public servicesEnabled = true;
  public permission: CustomerLocationPermission = 'GRANTED';
  public requestedPermission: CustomerLocationPermission = 'GRANTED';
  public coordinates: CustomerCoordinates = { latitude: 13.6288, longitude: 79.4192 };
  public coordinateReads = 0;

  public hasServicesEnabled(): Promise<boolean> {
    return Promise.resolve(this.servicesEnabled);
  }

  public getForegroundPermission(): Promise<CustomerLocationPermission> {
    return Promise.resolve(this.permission);
  }

  public requestForegroundPermission(): Promise<CustomerLocationPermission> {
    return Promise.resolve(this.requestedPermission);
  }

  public getCurrentCoordinates(): Promise<CustomerCoordinates> {
    this.coordinateReads += 1;
    return Promise.resolve(this.coordinates);
  }
}

class ServiceabilityPortStub implements CustomerServiceabilityPort {
  public result: CustomerServiceabilityResult = { kind: 'SERVICEABLE', nearbyShopCount: 1 };
  public checkedCoordinates: CustomerCoordinates[] = [];

  public checkLocation(coordinates: CustomerCoordinates): Promise<CustomerServiceabilityResult> {
    this.checkedCoordinates.push(coordinates);
    return Promise.resolve(this.result);
  }
}

describe('CustomerLocationScreen', () => {
  it('explains location use before requesting permission and accepts a serviceable location', async () => {
    const locationPort = new LocationPortStub();
    locationPort.permission = 'UNDETERMINED';
    const serviceabilityPort = new ServiceabilityPortStub();
    const ready: CustomerCoordinates[] = [];
    const { findByText, getByRole } = render(
      <CustomerLocationScreen
        locationPort={locationPort}
        onLocationReady={(coordinates) => ready.push(coordinates)}
        serviceabilityPort={serviceabilityPort}
      />,
    );

    expect(getByRole('header', { name: 'Find fashion near you' })).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Use current location' }));

    await findByText('Find fashion near you');
    expect(ready).toEqual([{ latitude: 13.6288, longitude: 79.4192 }]);
    expect(serviceabilityPort.checkedCoordinates).toEqual(ready);
  });

  it('offers manual fallback without reading coordinates when permission is denied', async () => {
    const locationPort = new LocationPortStub();
    locationPort.permission = 'DENIED';
    const { findByText, getByRole } = render(
      <CustomerLocationScreen
        locationPort={locationPort}
        onLocationReady={() => undefined}
        serviceabilityPort={new ServiceabilityPortStub()}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Use current location' }));

    expect(
      await findByText(
        'Location permission is off. Enter your area manually or allow location in device settings.',
      ),
    ).toBeTruthy();
    expect(await findByText('Manual location')).toBeTruthy();
    expect(locationPort.coordinateReads).toBe(0);
  });

  it('offers manual fallback when GPS services are disabled', async () => {
    const locationPort = new LocationPortStub();
    locationPort.servicesEnabled = false;
    const { findByText, getByRole } = render(
      <CustomerLocationScreen
        locationPort={locationPort}
        onLocationReady={() => undefined}
        serviceabilityPort={new ServiceabilityPortStub()}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Use current location' }));

    expect(
      await findByText(
        'Device location services are off. Turn them on or enter your area manually.',
      ),
    ).toBeTruthy();
    expect(locationPort.coordinateReads).toBe(0);
  });

  it('checks valid manual coordinates and preserves truthful outside-area recovery', async () => {
    const serviceabilityPort = new ServiceabilityPortStub();
    serviceabilityPort.result = { kind: 'OUTSIDE_SERVICE_AREA' };
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerLocationScreen
        locationPort={new LocationPortStub()}
        onLocationReady={() => undefined}
        serviceabilityPort={serviceabilityPort}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Enter location manually' }));
    fireEvent.changeText(getByLabelText('Location latitude'), '13.6288');
    fireEvent.changeText(getByLabelText('Location longitude'), '79.4192');
    fireEvent.press(getByRole('button', { name: 'Check manual location' }));

    expect(
      await findByText('Vastra does not yet have a serviceable local shop at this location.'),
    ).toBeTruthy();
    expect(serviceabilityPort.checkedCoordinates).toEqual([
      { latitude: 13.6288, longitude: 79.4192 },
    ]);
  });
});
