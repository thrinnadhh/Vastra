import { HttpCaptainPresenceClient } from './captain-presence.client';
import type { CaptainPresenceApiError } from './captain-presence.client';
import type { CaptainLocationSample } from './captain-presence.types';

const TOKEN = 'captain-token';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('HttpCaptainPresenceClient', () => {
  it('uses the frozen availability endpoint', async () => {
    const calls: { input: string; init: RequestInit }[] = [];
    const client = new HttpCaptainPresenceClient(
      'https://api.example.test/v1',
      () => Promise.resolve(TOKEN),
      (input, init) => {
        calls.push({ input, init });
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: {
              availability: {
                availabilityStatus: 'AVAILABLE',
                dispatchEligible: true,
                changed: true,
                location: {
                  fresh: true,
                  recordedAt: '2026-07-17T10:00:00.000Z',
                },
              },
            },
          }),
        );
      },
    );

    await expect(client.setAvailability('AVAILABLE')).resolves.toMatchObject({
      availabilityStatus: 'AVAILABLE',
      dispatchEligible: true,
    });
    expect(calls[0]?.input).toBe('https://api.example.test/v1/captain/me/availability');
    expect(calls[0]?.init.method).toBe('PUT');
  });

  it('reads availability from /me with bearer authentication', async () => {
    const calls: { input: string; init: RequestInit }[] = [];
    const client = new HttpCaptainPresenceClient(
      'https://api.example.test/v1',
      () => Promise.resolve(TOKEN),
      (input, init) => {
        calls.push({ input, init });
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: { roleProfile: { availabilityStatus: 'ON_BREAK' } },
          }),
        );
      },
    );

    await expect(client.getAvailability()).resolves.toBe('ON_BREAK');
    expect(calls[0]?.input).toBe('https://api.example.test/v1/me');
    expect(new Headers(calls[0]?.init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('sends the complete idempotent location sample and preserves replay state', async () => {
    const sample: CaptainLocationSample = {
      sampleId: '20000000-0000-4000-8000-000000000001',
      latitude: 13.628,
      longitude: 79.419,
      accuracyMeters: 8,
      recordedAt: '2026-07-21T10:00:00.000Z',
      heading: 90,
      speedMps: 4,
      batteryPercent: 70,
      activeDeliveryTaskId: null,
    };
    const calls: RequestInit[] = [];
    const client = new HttpCaptainPresenceClient(
      'https://api.example.test/v1',
      () => Promise.resolve(TOKEN),
      (_input, init) => {
        calls.push(init);
        return Promise.resolve(
          jsonResponse(200, {
            success: true,
            data: {
              location: {
                sampleId: sample.sampleId,
                acceptedAt: '2026-07-21T10:00:01.000Z',
                replayed: true,
              },
            },
          }),
        );
      },
    );

    await expect(client.updateLocation(sample)).resolves.toMatchObject({
      sampleId: sample.sampleId,
      replayed: true,
    });
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.body).toBe(JSON.stringify(sample));
  });

  it('preserves backend location and eligibility errors', async () => {
    const client = new HttpCaptainPresenceClient(
      'https://api.example.test/v1',
      () => Promise.resolve(TOKEN),
      () =>
        Promise.resolve(
          jsonResponse(409, {
            success: false,
            error: {
              code: 'DELIVERY_STATE_CONFLICT',
              message: 'Active delivery controls availability',
              retryable: false,
            },
          }),
        ),
    );

    await expect(client.setAvailability('OFFLINE')).rejects.toMatchObject<
      Partial<CaptainPresenceApiError>
    >({
      code: 'DELIVERY_STATE_CONFLICT',
      retryable: false,
    });
  });
});
