import { describe, expect, it, vi } from 'vitest';

import { MerchantAlertObservabilityService } from './merchant-alert-observability.service';
import type {
  MerchantAlertDeliveryActivity,
  MerchantAlertDeliveryMetrics,
  MerchantAlertObservabilityGateway,
} from './merchant-alert-observability.types';

const metrics: MerchantAlertDeliveryMetrics = {
  windowMinutes: 60,
  generatedAt: '2026-07-17T09:00:00.000Z',
  alertsCreated: 10,
  alertsSent: 9,
  alertsAcknowledged: 7,
  alertsExpired: 1,
  alertsFailed: 1,
  averageAcknowledgementSeconds: 42,
  activeAlerts: 1,
  remindersQueued: 3,
  deliveryAttempts: 12,
  successfulAttempts: 9,
  failedAttempts: 3,
  retryableFailures: 2,
  unregisteredTokens: 1,
  outboxBacklog: 1,
};

const activity: MerchantAlertDeliveryActivity = {
  alertId: '10000000-0000-4000-8000-000000000001',
  orderId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-1',
  shopId: '30000000-0000-4000-8000-000000000001',
  shopName: 'Vastra Shop',
  alertStatus: 'ACKNOWLEDGED',
  attemptCount: 1,
  reminderCount: 0,
  createdAt: '2026-07-17T08:58:00.000Z',
  expiresAt: '2026-07-17T09:13:00.000Z',
  acknowledgedAt: '2026-07-17T08:59:00.000Z',
  expiredAt: null,
  failureReason: null,
  successfulDeviceAttempts: 1,
  failedDeviceAttempts: 0,
  retryableDeviceFailures: 0,
  lastAttemptAt: '2026-07-17T08:58:01.000Z',
  lastFailureCode: null,
};

describe('MerchantAlertObservabilityService', () => {
  it('returns bounded operations metrics', async () => {
    const getMetrics = vi.fn<MerchantAlertObservabilityGateway['getMetrics']>();
    getMetrics.mockResolvedValue(metrics);
    const listActivity = vi.fn<MerchantAlertObservabilityGateway['listActivity']>();
    listActivity.mockResolvedValue([]);
    const gateway: MerchantAlertObservabilityGateway = { getMetrics, listActivity };
    const service = new MerchantAlertObservabilityService(gateway);

    await expect(service.getMetrics('60')).resolves.toEqual({
      success: true,
      data: { metrics },
      meta: { requestId: null },
    });
    expect(getMetrics).toHaveBeenCalledWith(60);
  });

  it('returns activity with a stable timestamp cursor', async () => {
    const listActivity = vi.fn<MerchantAlertObservabilityGateway['listActivity']>();
    listActivity.mockResolvedValue([activity]);
    const getMetrics = vi.fn<MerchantAlertObservabilityGateway['getMetrics']>();
    getMetrics.mockResolvedValue(metrics);
    const gateway: MerchantAlertObservabilityGateway = { getMetrics, listActivity };
    const service = new MerchantAlertObservabilityService(gateway);

    await expect(service.listActivity('1', undefined)).resolves.toEqual({
      success: true,
      data: { activity: [activity], nextCursor: activity.createdAt },
      meta: { requestId: null },
    });
    expect(listActivity).toHaveBeenCalledWith(1, null);
  });
});
