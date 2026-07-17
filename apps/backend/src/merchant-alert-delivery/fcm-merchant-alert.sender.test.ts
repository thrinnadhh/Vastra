import { afterEach, describe, expect, it, vi } from 'vitest';

import { FcmMerchantAlertSender } from './fcm-merchant-alert.sender';
import type { FcmAccessTokenProvider } from './firebase-access-token.service';
import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import type {
  MerchantAlertDeviceDestination,
  MerchantAlertDispatchClaim,
} from './merchant-alert-delivery.types';

const CONFIGURATION: MerchantAlertDeliveryConfiguration = {
  enabled: true,
  workerId: 'worker-one',
  pollIntervalMs: 5_000,
  batchSize: 10,
  requestTimeoutMs: 10_000,
  credentials: {
    projectId: 'vastra-test',
    clientEmail: 'firebase-admin@example.test',
    privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  },
};

const DESTINATION: MerchantAlertDeviceDestination = {
  deviceId: '50000000-0000-4000-8000-000000000001',
  pushToken: 'token-one',
};

const CLAIM: MerchantAlertDispatchClaim = {
  eventId: '10000000-0000-4000-8000-000000000001',
  alertId: '20000000-0000-4000-8000-000000000001',
  orderId: '30000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-7001',
  shopId: '40000000-0000-4000-8000-000000000001',
  shopName: 'Alert Shop',
  totalPaise: 54_500,
  expiresAt: '2026-07-17T06:30:00.000Z',
  soundName: 'vastra_new_order',
  eventAttemptNumber: 1,
  eventMaxAttempts: 12,
  deliverable: true,
  stopReason: null,
  devices: [DESTINATION],
};

const ACCESS_TOKEN_PROVIDER: FcmAccessTokenProvider = {
  getAccessToken: vi.fn(() => Promise.resolve('short-lived-access-token')),
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('FcmMerchantAlertSender', () => {
  it('returns the provider message name after a successful HTTP v1 send', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ name: 'projects/vastra-test/messages/message-one' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const sender = new FcmMerchantAlertSender(CONFIGURATION, ACCESS_TOKEN_PROVIDER);

    const result = await sender.send(CLAIM, DESTINATION);

    expect(result).toEqual({
      deviceId: DESTINATION.deviceId,
      outcome: 'SENT',
      providerMessageId: 'projects/vastra-test/messages/message-one',
      failureCode: null,
      failureReason: null,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/v1/projects/vastra-test/messages:send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('classifies an unregistered token as permanent so the database can revoke it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                status: 'NOT_FOUND',
                message: 'Requested entity was not found.',
                details: [
                  {
                    '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                    errorCode: 'UNREGISTERED',
                  },
                ],
              },
            }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    const sender = new FcmMerchantAlertSender(CONFIGURATION, ACCESS_TOKEN_PROVIDER);

    const result = await sender.send(CLAIM, DESTINATION);

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'UNREGISTERED',
      retryable: false,
    });
  });

  it('classifies provider unavailability as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Try again later' } }),
            { status: 503, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    const sender = new FcmMerchantAlertSender(CONFIGURATION, ACCESS_TOKEN_PROVIDER);

    const result = await sender.send(CLAIM, DESTINATION);

    expect(result).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'UNAVAILABLE',
      retryable: true,
    });
  });
});
