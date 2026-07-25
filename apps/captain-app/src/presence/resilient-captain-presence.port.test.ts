import { CaptainPresenceApiError } from './captain-presence.client';
import { ResilientCaptainPresencePort } from './resilient-captain-presence.port';
import type { CaptainLocationSample, CaptainPresencePort } from './captain-presence.types';

const SAMPLE: CaptainLocationSample = {
  sampleId: '50000000-0000-4000-8000-000000000001',
  latitude: 13.628,
  longitude: 79.419,
  accuracyMeters: 8,
  recordedAt: '2026-07-25T10:00:00.000Z',
  heading: null,
  speedMps: null,
  batteryPercent: null,
  activeDeliveryTaskId: null,
};

function delegate(): jest.Mocked<CaptainPresencePort> {
  return {
    getAvailability: jest.fn(() => Promise.resolve('AVAILABLE')),
    setAvailability: jest.fn((..._args: Parameters<CaptainPresencePort['setAvailability']>) =>
      Promise.resolve({
        availabilityStatus: 'AVAILABLE',
        dispatchEligible: true,
        changed: true,
        locationFresh: true,
        locationRecordedAt: SAMPLE.recordedAt,
      }),
    ),
    updateLocation: jest.fn((..._args: Parameters<CaptainPresencePort['updateLocation']>) =>
      Promise.resolve({
        sampleId: SAMPLE.sampleId,
        acceptedAt: SAMPLE.recordedAt,
        replayed: false,
      }),
    ),
  };
}

describe('ResilientCaptainPresencePort', () => {
  it('shares overlapping availability reads', async () => {
    let resolveAvailability: ((value: 'AVAILABLE') => void) | undefined;
    const source = delegate();
    source.getAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAvailability = resolve;
        }),
    );
    const port = new ResilientCaptainPresencePort(source, jest.fn());

    const first = port.getAvailability();
    const second = port.getAvailability();
    expect(first).toBe(second);
    expect(source.getAvailability).toHaveBeenCalledTimes(1);

    resolveAvailability?.('AVAILABLE');
    await expect(first).resolves.toBe('AVAILABLE');
  });

  it.each(['AUTHENTICATION_REQUIRED', 'AUTHENTICATION_INVALID', 'SESSION_EXPIRED'])(
    'expires the local session for %s',
    async (code: string) => {
      const source = delegate();
      const expire = jest.fn();
      source.setAvailability.mockRejectedValue(
        new CaptainPresenceApiError(code, 'Sign in again.', false),
      );
      const port = new ResilientCaptainPresencePort(source, expire);

      await expect(port.setAvailability('AVAILABLE')).rejects.toBeInstanceOf(
        CaptainPresenceApiError,
      );
      expect(expire).toHaveBeenCalledTimes(1);
    },
  );

  it('does not expire the session for an operational location error', async () => {
    const source = delegate();
    const expire = jest.fn();
    source.updateLocation.mockRejectedValue(
      new CaptainPresenceApiError('CAPTAIN_LOCATION_STALE', 'Location stale.', false),
    );
    const port = new ResilientCaptainPresencePort(source, expire);

    await expect(port.updateLocation(SAMPLE)).rejects.toBeInstanceOf(CaptainPresenceApiError);
    expect(expire).not.toHaveBeenCalled();
  });
});
