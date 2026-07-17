import { describe, expect, it, vi } from 'vitest';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import { MerchantAlertSchedulerService } from './merchant-alert-scheduler.service';
import type { MerchantAlertSchedulerGateway } from './merchant-alert-scheduler.types';

const configuration: MerchantAlertDeliveryConfiguration = {
  enabled: true,
  workerId: 'scheduler-worker',
  pollIntervalMs: 5_000,
  batchSize: 25,
  requestTimeoutMs: 10_000,
  credentials: null,
};

describe('MerchantAlertSchedulerService', () => {
  it('processes due alerts with the configured worker and batch size', async () => {
    const processDueAlerts = vi.fn<MerchantAlertSchedulerGateway['processDueAlerts']>();
    processDueAlerts.mockResolvedValue({
      processed: 4,
      remindersQueued: 2,
      expired: 2,
      stopped: 1,
    });
    const gateway: MerchantAlertSchedulerGateway = { processDueAlerts };
    const service = new MerchantAlertSchedulerService(configuration, gateway);

    await expect(service.processDue()).resolves.toEqual({
      processed: 4,
      remindersQueued: 2,
      expired: 2,
      stopped: 1,
    });
    expect(processDueAlerts).toHaveBeenCalledWith('scheduler-worker', 25);
  });

  it('supports a bounded explicit batch size', async () => {
    const processDueAlerts = vi.fn<MerchantAlertSchedulerGateway['processDueAlerts']>();
    processDueAlerts.mockResolvedValue({
      processed: 0,
      remindersQueued: 0,
      expired: 0,
      stopped: 0,
    });
    const service = new MerchantAlertSchedulerService(configuration, { processDueAlerts });

    await service.processDue(5);

    expect(processDueAlerts).toHaveBeenCalledWith('scheduler-worker', 5);
  });
});
