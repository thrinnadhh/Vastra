import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as MockText } from 'react-native';

jest.mock('./src/auth/default-captain-session', () => ({
  CaptainSessionApp: ({ children }: { readonly children: ReactNode }) => children,
}));

jest.mock('./src/captain-operations.screen', () => ({
  CaptainOperationsScreen: () => <MockText>Captain operations</MockText>,
}));

import App from './App';
import { CaptainPresenceScreen } from './src/presence/captain-presence.screen';
import type {
  CaptainAvailabilityResult,
  CaptainAvailabilityStatus,
  CaptainLocationProvider,
  CaptainLocationResult,
  CaptainLocationSample,
  CaptainPresencePort,
  CaptainRequestedAvailabilityStatus,
} from './src/presence/captain-presence.types';

const SAMPLE: CaptainLocationSample = {
  sampleId: '20000000-0000-4000-8000-000000000001',
  latitude: 13.6288,
  longitude: 79.4192,
  accuracyMeters: 12,
  recordedAt: '2026-07-17T10:00:00.000Z',
  heading: null,
  speedMps: null,
  batteryPercent: null,
  activeDeliveryTaskId: null,
};

class FakePresenceClient implements CaptainPresencePort {
  public status: CaptainAvailabilityStatus = 'OFFLINE';
  public updates: CaptainLocationSample[] = [];

  public getAvailability(): Promise<CaptainAvailabilityStatus> {
    return Promise.resolve(this.status);
  }

  public setAvailability(
    status: CaptainRequestedAvailabilityStatus,
  ): Promise<CaptainAvailabilityResult> {
    this.status = status;
    return Promise.resolve({
      availabilityStatus: status,
      dispatchEligible: status === 'AVAILABLE',
      changed: true,
      locationFresh: status === 'AVAILABLE',
      locationRecordedAt: status === 'AVAILABLE' ? '2026-07-17T10:00:01.000Z' : null,
    });
  }

  public updateLocation(sample: CaptainLocationSample): Promise<CaptainLocationResult> {
    this.updates.push(sample);
    return Promise.resolve({
      sampleId: sample.sampleId,
      acceptedAt: '2026-07-17T10:00:01.000Z',
      replayed: false,
    });
  }
}

class FakeLocationProvider implements CaptainLocationProvider {
  public permissionGranted = true;
  public watchListener: ((sample: CaptainLocationSample) => void) | null = null;

  public requestForegroundPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    return Promise.resolve({ granted: this.permissionGranted, canAskAgain: true });
  }

  public getCurrentLocation(): Promise<CaptainLocationSample> {
    return Promise.resolve(SAMPLE);
  }

  public watchLocations(listener: (sample: CaptainLocationSample) => void): Promise<() => void> {
    this.watchListener = listener;
    return Promise.resolve(() => {
      this.watchListener = null;
    });
  }
}

describe('Captain application shell', () => {
  it('mounts captain operations inside the shared mobile shell', () => {
    const { getByTestId, getByText } = render(<App />);

    expect(getByTestId('captain-application-shell')).toBeTruthy();
    expect(getByText('Captain operations')).toBeTruthy();
  });
});

describe('CaptainPresenceScreen', () => {
  it('submits a fresh location before going online', async () => {
    const client = new FakePresenceClient();
    const location = new FakeLocationProvider();
    const view = render(<CaptainPresenceScreen client={client} locationProvider={location} />);

    await waitFor(() => {
      expect(view.getByLabelText('Go online for deliveries')).toBeTruthy();
    });

    fireEvent.press(view.getByLabelText('Go online for deliveries'));

    await waitFor(() => {
      expect(view.getByLabelText('Captain availability AVAILABLE')).toBeTruthy();
    });
    expect(client.updates).toEqual([SAMPLE]);
  });

  it('explains why location permission is required', async () => {
    const client = new FakePresenceClient();
    const location = new FakeLocationProvider();
    location.permissionGranted = false;
    const view = render(<CaptainPresenceScreen client={client} locationProvider={location} />);

    await waitFor(() => {
      expect(view.getByLabelText('Go online for deliveries')).toBeTruthy();
    });
    fireEvent.press(view.getByLabelText('Go online for deliveries'));

    expect(
      await view.findByText('Location permission is required to receive nearby delivery offers.'),
    ).toBeTruthy();
    expect(client.updates).toHaveLength(0);
  });

  it('stops offer eligibility when the captain goes offline', async () => {
    const client = new FakePresenceClient();
    client.status = 'AVAILABLE';
    const location = new FakeLocationProvider();
    const view = render(<CaptainPresenceScreen client={client} locationProvider={location} />);

    await waitFor(() => {
      expect(view.getByLabelText('Go offline from deliveries')).toBeTruthy();
    });

    fireEvent.press(view.getByLabelText('Go offline from deliveries'));

    await waitFor(() => {
      expect(view.getByLabelText('Captain availability OFFLINE')).toBeTruthy();
    });
  });
});
