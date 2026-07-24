import type { MerchantApiSession } from '../auth/merchant-api-session';
import { HttpMerchantDeviceRegistrationClient } from './merchant-device-registration.client';
import type { MerchantDeviceRegistrationError } from './merchant-device-registration.client';

const INPUT = {
  deviceFingerprint: 'device-fingerprint',
  pushToken: 'private-fcm-token',
  appVersion: '1.0.0',
  deviceModel: 'Pixel',
  osVersion: '16',
} as const;

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

function session(getAccessToken: MerchantApiSession['getAccessToken']): MerchantApiSession {
  return { apiBaseUrl: 'https://api.example.test', getAccessToken };
}

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

function fetchMock(): jest.MockedFunction<FetchFunction> {
  return jest.fn<ReturnType<FetchFunction>, Parameters<FetchFunction>>();
}

describe('HttpMerchantDeviceRegistrationClient', () => {
  it('classifies a missing session without sending the private token', async () => {
    const transport = fetchMock();
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve(null)),
      transport,
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<
      Partial<MerchantDeviceRegistrationError>
    >({
      kind: 'SESSION_EXPIRED',
      status: null,
    });
    expect(transport.mock.calls).toHaveLength(0);
  });

  it('classifies transport failure as offline or stale', async () => {
    const transport = fetchMock();
    transport.mockRejectedValue(new TypeError('offline'));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
      transport,
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<
      Partial<MerchantDeviceRegistrationError>
    >({
      kind: 'OFFLINE_STALE',
    });
  });

  it.each([
    [401, 'SESSION_EXPIRED'],
    [429, 'OFFLINE_STALE'],
    [503, 'OFFLINE_STALE'],
    [400, 'BACKEND_REGISTRATION_FAILED'],
  ] as const)('classifies HTTP %s as %s', async (status, kind) => {
    const transport = fetchMock();
    transport.mockResolvedValue(response(status));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
      transport,
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<
      Partial<MerchantDeviceRegistrationError>
    >({
      kind,
      status,
    });
  });

  it('registers the native FCM device using the existing backend contract', async () => {
    const transport = fetchMock();
    transport.mockResolvedValue(response(201));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
      transport,
    );

    await expect(client.register(INPUT)).resolves.toBeUndefined();
    expect(transport.mock.calls).toHaveLength(1);
    const call = transport.mock.calls[0];
    if (call === undefined) throw new TypeError('Expected one registration request');
    const [url, init] = call;
    expect(url).toBe('https://api.example.test/me/devices');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token');
    if (typeof init.body !== 'string') throw new TypeError('Expected JSON request body');
    expect(init.body).toContain('private-fcm-token');
  });
});
