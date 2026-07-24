import type { MerchantApiSession } from '../auth/merchant-api-session';
import {
  HttpMerchantDeviceRegistrationClient,
  MerchantDeviceRegistrationError,
} from './merchant-device-registration.client';

const INPUT = {
  deviceFingerprint: 'device-fingerprint',
  pushToken: 'private-fcm-token',
  appVersion: '1.0.0',
  deviceModel: 'Pixel',
  osVersion: '16',
} as const;

function session(getAccessToken: MerchantApiSession['getAccessToken']): MerchantApiSession {
  return { apiBaseUrl: 'https://api.example.test', getAccessToken };
}

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('HttpMerchantDeviceRegistrationClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('classifies a missing session without sending the private token', async () => {
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve(null)),
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<Partial<MerchantDeviceRegistrationError>>({
      kind: 'SESSION_EXPIRED',
      status: null,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('classifies transport failure as offline or stale', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<Partial<MerchantDeviceRegistrationError>>({
      kind: 'OFFLINE_STALE',
    });
  });

  it.each([
    [401, 'SESSION_EXPIRED'],
    [429, 'OFFLINE_STALE'],
    [503, 'OFFLINE_STALE'],
    [400, 'BACKEND_REGISTRATION_FAILED'],
  ] as const)('classifies HTTP %s as %s', async (status, kind) => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(response(status));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
    );

    await expect(client.register(INPUT)).rejects.toMatchObject<Partial<MerchantDeviceRegistrationError>>({
      kind,
      status,
    });
  });

  it('registers the native FCM device using the existing backend contract', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(response(201));
    const client = new HttpMerchantDeviceRegistrationClient(
      session(() => Promise.resolve('access-token')),
    );

    await expect(client.register(INPUT)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/me/devices',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
        body: expect.stringContaining('private-fcm-token'),
      }),
    );
  });
});
