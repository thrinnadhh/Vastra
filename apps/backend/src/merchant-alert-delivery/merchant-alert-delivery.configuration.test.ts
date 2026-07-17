import { describe, expect, it } from 'vitest';

import { loadMerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';

describe('merchant alert delivery configuration', () => {
  it('is safely disabled without Firebase credentials by default', () => {
    const configuration = loadMerchantAlertDeliveryConfiguration({});

    expect(configuration.enabled).toBe(false);
    expect(configuration.credentials).toBeNull();
    expect(configuration.batchSize).toBe(10);
    expect(configuration.pollIntervalMs).toBe(5_000);
  });

  it('loads backend-only Firebase credentials when explicitly enabled', () => {
    const configuration = loadMerchantAlertDeliveryConfiguration({
      MERCHANT_ALERT_DELIVERY_ENABLED: 'true',
      MERCHANT_ALERT_DELIVERY_WORKER_ID: 'worker-one',
      MERCHANT_ALERT_DELIVERY_BATCH_SIZE: '25',
      FCM_PROJECT_ID: 'vastra-pilot',
      FCM_CLIENT_EMAIL: 'firebase-admin@vastra-pilot.iam.gserviceaccount.com',
      FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nlocal-test-key\\n-----END PRIVATE KEY-----',
    });

    expect(configuration.enabled).toBe(true);
    expect(configuration.workerId).toBe('worker-one');
    expect(configuration.batchSize).toBe(25);
    expect(configuration.credentials).toEqual({
      projectId: 'vastra-pilot',
      clientEmail: 'firebase-admin@vastra-pilot.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nlocal-test-key\n-----END PRIVATE KEY-----',
    });
  });

  it('rejects an ambiguous worker enablement value', () => {
    expect(() =>
      loadMerchantAlertDeliveryConfiguration({ MERCHANT_ALERT_DELIVERY_ENABLED: 'yes' }),
    ).toThrow('MERCHANT_ALERT_DELIVERY_ENABLED');
  });
});
