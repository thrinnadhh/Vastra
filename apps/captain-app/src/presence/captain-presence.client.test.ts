import { HttpCaptainPresenceClient } from './captain-presence.client';

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
});
