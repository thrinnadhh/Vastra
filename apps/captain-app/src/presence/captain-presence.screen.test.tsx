import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { CaptainPresenceScreen } from './captain-presence.screen';
import type {
  CaptainLocationProvider,
  CaptainLocationSample,
  CaptainPresencePort,
} from './captain-presence.types';

jest.mock('./expo-captain-location.provider', () => ({
  ExpoCaptainLocationProvider: jest.fn(),
}));

const SAMPLE: CaptainLocationSample = {
  sampleId: '20000000-0000-4000-8000-000000000001',
  latitude: 13.628,
  longitude: 79.419,
  accuracyMeters: 8,
  recordedAt: '2026-07-21T10:00:00.000Z',
  heading: null,
  speedMps: null,
  batteryPercent: null,
  activeDeliveryTaskId: null,
};

function client(status: 'OFFLINE' | 'AVAILABLE' = 'OFFLINE'): jest.Mocked<CaptainPresencePort> {
  return {
    getAvailability: jest.fn(() => Promise.resolve(status)),
    setAvailability: jest.fn((next) =>
      Promise.resolve({
        availabilityStatus: next,
        dispatchEligible: next === 'AVAILABLE',
        changed: true,
        locationFresh: next === 'AVAILABLE',
        locationRecordedAt: next === 'AVAILABLE' ? SAMPLE.recordedAt : null,
      }),
    ),
    updateLocation: jest.fn((sample) =>
      Promise.resolve({
        sampleId: sample.sampleId,
        acceptedAt: sample.recordedAt,
        replayed: false,
      }),
    ),
  };
}

function locationProvider(granted = true): jest.Mocked<CaptainLocationProvider> {
  return {
    requestForegroundPermission: jest.fn(() => Promise.resolve({ granted, canAskAgain: true })),
    getCurrentLocation: jest.fn(() => Promise.resolve(SAMPLE)),
    watchLocations: jest.fn((...args: Parameters<CaptainLocationProvider['watchLocations']>) => {
      void args;
      return Promise.resolve(() => undefined);
    }),
  };
}

describe('CaptainPresenceScreen preservation', () => {
  it('requires permission and a fresh location before becoming available', async () => {
    const presence = client();
    const locations = locationProvider();
    const view = render(<CaptainPresenceScreen client={presence} locationProvider={locations} />);
    expect(await view.findByLabelText('Captain availability OFFLINE')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Go online for deliveries'));

    await waitFor(() => {
      expect(presence.setAvailability.mock.calls).toContainEqual(['AVAILABLE']);
    });
    expect(locations.requestForegroundPermission.mock.calls).toHaveLength(1);
    expect(presence.updateLocation.mock.calls).toContainEqual([SAMPLE]);
    expect(presence.updateLocation.mock.invocationCallOrder[0]).toBeLessThan(
      presence.setAvailability.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(await view.findByLabelText('Captain availability AVAILABLE')).toBeTruthy();
  });

  it('does not update location or availability when permission is denied', async () => {
    const presence = client();
    const view = render(
      <CaptainPresenceScreen client={presence} locationProvider={locationProvider(false)} />,
    );
    expect(await view.findByLabelText('Captain availability OFFLINE')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Go online for deliveries'));

    expect(
      await view.findByText('Location permission is required to receive nearby delivery offers.'),
    ).toBeTruthy();
    expect(presence.updateLocation.mock.calls).toHaveLength(0);
    expect(presence.setAvailability.mock.calls).toHaveLength(0);
  });

  it('serializes foreground samples and stops watching after leaving the screen', async () => {
    let listener: ((sample: CaptainLocationSample) => void) | undefined;
    let resolveFirst: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const stopWatching = jest.fn();
    const presence = client('AVAILABLE');
    presence.updateLocation
      .mockImplementationOnce(async (sample) => {
        await first;
        return { sampleId: sample.sampleId, acceptedAt: sample.recordedAt, replayed: false };
      })
      .mockImplementation((sample) =>
        Promise.resolve({
          sampleId: sample.sampleId,
          acceptedAt: sample.recordedAt,
          replayed: false,
        }),
      );
    const locations = locationProvider();
    locations.watchLocations.mockImplementation((next) => {
      listener = next;
      return Promise.resolve(stopWatching);
    });
    const view = render(<CaptainPresenceScreen client={presence} locationProvider={locations} />);
    expect(await view.findByLabelText('Captain availability AVAILABLE')).toBeTruthy();
    await waitFor(() => {
      expect(locations.watchLocations.mock.calls).toHaveLength(1);
    });

    act(() => {
      listener?.(SAMPLE);
      listener?.({ ...SAMPLE, sampleId: '20000000-0000-4000-8000-000000000002' });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(presence.updateLocation.mock.calls).toHaveLength(1);

    await act(async () => {
      resolveFirst?.();
      await first;
      await Promise.resolve();
    });
    expect(presence.updateLocation.mock.calls).toHaveLength(2);

    view.unmount();
    expect(stopWatching).toHaveBeenCalledTimes(1);
  });
});
