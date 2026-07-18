import { describe, expect, it } from 'vitest';

import { loadDeliveryDispatchConfiguration } from './delivery-dispatch.configuration';

describe('delivery dispatch configuration', () => {
  it('is disabled with frozen MVP defaults', () => {
    expect(
      loadDeliveryDispatchConfiguration({ DELIVERY_DISPATCH_WORKER_ID: 'backend-test-1' }),
    ).toStrictEqual({
      enabled: false,
      workerId: 'backend-test-1',
      pollIntervalMs: 5000,
      dueTaskLimit: 10,
      initialRadiusMeters: 2000,
      radiusStepMeters: 2000,
      maxRadiusMeters: 8000,
      captainsPerWave: 3,
      offerLifetimeSeconds: 30,
      waveIntervalSeconds: 30,
    });
  });

  it('rejects invalid configured bounds', () => {
    expect(() =>
      loadDeliveryDispatchConfiguration({
        DELIVERY_DISPATCH_WORKER_ID: 'backend-test-1',
        DELIVERY_DISPATCH_INITIAL_RADIUS_METERS: '9000',
        DELIVERY_DISPATCH_MAX_RADIUS_METERS: '8000',
      }),
    ).toThrow('DELIVERY_DISPATCH_MAX_RADIUS_METERS');
  });
});
