import { describe, expect, it, vi } from 'vitest';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import type {
  CompleteMerchantAlertDispatchCommand,
  CompleteMerchantAlertDispatchResult,
  MerchantAlertDeliveryGateway,
  MerchantAlertDispatchClaim,
  MerchantAlertSender,
} from './merchant-alert-delivery.types';
import { MerchantAlertDispatchService } from './merchant-alert-dispatch.service';

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

function claim(overrides: Partial<MerchantAlertDispatchClaim> = {}): MerchantAlertDispatchClaim {
  return {
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
    devices: [
      {
        deviceId: '50000000-0000-4000-8000-000000000001',
        pushToken: 'token-one',
      },
    ],
    ...overrides,
  };
}

function completion(
  command: CompleteMerchantAlertDispatchCommand,
  overrides: Partial<CompleteMerchantAlertDispatchResult> = {},
): CompleteMerchantAlertDispatchResult {
  return {
    eventId: command.eventId,
    alertId: command.alertId,
    eventStatus: 'PUBLISHED',
    alertStatus: 'SENT',
    successfulDevices: command.results.filter((result) => result.outcome === 'SENT').length,
    failedDevices: command.results.filter((result) => result.outcome === 'FAILED').length,
    retryAt: null,
    stopped: command.stopReason !== null,
    ...overrides,
  };
}

function dependencies(claims: readonly MerchantAlertDispatchClaim[]) {
  const completeDispatch = vi.fn(async (command: CompleteMerchantAlertDispatchCommand) =>
    completion(command),
  );
  const gateway: MerchantAlertDeliveryGateway = {
    claimDispatches: vi.fn(async () => claims),
    completeDispatch,
  };
  const sender: MerchantAlertSender = {
    send: vi.fn(async (_claim, destination) => ({
      deviceId: destination.deviceId,
      outcome: 'SENT' as const,
      providerMessageId: `projects/test/messages/${destination.deviceId}`,
      failureCode: null,
      failureReason: null,
      retryable: false,
    })),
  };

  return { gateway, sender, completeDispatch };
}

describe('MerchantAlertDispatchService', () => {
  it('publishes a terminal claim without calling FCM', async () => {
    const stoppedClaim = claim({
      deliverable: false,
      stopReason: 'ORDER_NOT_WAITING',
      devices: [],
    });
    const { gateway, sender, completeDispatch } = dependencies([stoppedClaim]);
    const service = new MerchantAlertDispatchService(CONFIGURATION, gateway, sender);

    const summary = await service.drain();

    expect(sender.send).not.toHaveBeenCalled();
    expect(completeDispatch).toHaveBeenCalledWith({
      workerId: 'worker-one',
      eventId: stoppedClaim.eventId,
      alertId: stoppedClaim.alertId,
      stopReason: 'ORDER_NOT_WAITING',
      results: [],
    });
    expect(summary).toMatchObject({ claimed: 1, published: 1, stopped: 1 });
  });

  it('sends every eligible device and completes the durable event once', async () => {
    const activeClaim = claim({
      devices: [
        { deviceId: '50000000-0000-4000-8000-000000000001', pushToken: 'token-one' },
        { deviceId: '50000000-0000-4000-8000-000000000002', pushToken: 'token-two' },
      ],
    });
    const { gateway, sender, completeDispatch } = dependencies([activeClaim]);
    const service = new MerchantAlertDispatchService(CONFIGURATION, gateway, sender);

    const summary = await service.drain();

    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(completeDispatch).toHaveBeenCalledTimes(1);
    const command = completeDispatch.mock.calls[0]![0];
    expect(command.stopReason).toBeNull();
    expect(command.results).toHaveLength(2);
    expect(command.results.every((result) => result.outcome === 'SENT')).toBe(true);
    expect(summary).toMatchObject({ claimed: 1, published: 1, retrying: 0 });
  });

  it('turns an unexpected sender exception into a retryable device result', async () => {
    const activeClaim = claim();
    const { gateway, sender, completeDispatch } = dependencies([activeClaim]);
    vi.mocked(sender.send).mockRejectedValueOnce(new Error('do not expose token'));
    const service = new MerchantAlertDispatchService(CONFIGURATION, gateway, sender);

    await service.drain();

    const command = completeDispatch.mock.calls[0]![0];
    expect(command.results).toEqual([
      {
        deviceId: activeClaim.devices[0]!.deviceId,
        outcome: 'FAILED',
        providerMessageId: null,
        failureCode: 'Error',
        failureReason: 'Merchant alert sender failed unexpectedly',
        retryable: true,
      },
    ]);
  });
});
