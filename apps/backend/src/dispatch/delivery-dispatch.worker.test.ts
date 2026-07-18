import { describe, expect, it } from 'vitest';

import type { DeliveryDispatchConfiguration } from './delivery-dispatch.configuration';
import { DeliveryDispatchWorker } from './delivery-dispatch.worker';
import type { DeliveryGateway } from './delivery.gateway';
import type { DeliveryOfferWaveConfiguration } from './delivery.types';

const configuration: DeliveryDispatchConfiguration = {
  enabled: true,
  workerId: 'backend-test-1',
  pollIntervalMs: 5000,
  dueTaskLimit: 10,
  initialRadiusMeters: 2000,
  radiusStepMeters: 2000,
  maxRadiusMeters: 8000,
  captainsPerWave: 3,
  offerLifetimeSeconds: 30,
  waveIntervalSeconds: 30,
};

describe('delivery dispatch worker', () => {
  it('runs a coordinated dispatch cycle with the frozen configuration', async () => {
    const calls: DeliveryOfferWaveConfiguration[] = [];
    const gateway = {
      runDispatchCycle(received: DeliveryOfferWaveConfiguration) {
        calls.push(received);
        return Promise.resolve({
          workerId: received.workerId,
          dispatchesStarted: 0,
          dispatchFailures: [],
          taskResults: [],
        });
      },
    } as unknown as DeliveryGateway;
    const worker = new DeliveryDispatchWorker(configuration, gateway);

    await worker.drainOnce();

    expect(calls).toStrictEqual([
      {
        workerId: 'backend-test-1',
        limit: 10,
        initialRadiusMeters: 2000,
        radiusStepMeters: 2000,
        maxRadiusMeters: 8000,
        captainsPerWave: 3,
        offerLifetimeSeconds: 30,
        waveIntervalSeconds: 30,
      },
    ]);
  });
});
