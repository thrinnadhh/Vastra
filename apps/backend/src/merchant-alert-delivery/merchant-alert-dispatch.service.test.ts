import { describe, expect, it } from 'vitest';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import type {
  CompleteMerchantAlertDispatchCommand,
  CompleteMerchantAlertDispatchResult,
  MerchantAlertDeliveryGateway,
  MerchantAlertDeviceDestination,
  MerchantAlertDeviceResult,
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

const DEVICE_ONE: MerchantAlertDeviceDestination = {
  deviceId: '50000000-0000-4000-8000-000000000001',
  pushToken: 'token-one',
};

const DEVICE_TWO: MerchantAlertDeviceDestination = {
  deviceId: '50000000-0000-4000-8000-000000000002',
  pushToken: 'token-two',
};

interface TestDependencies {
  readonly gateway: MerchantAlertDeliveryGateway;
  readonly sender: MerchantAlertSender;
  readonly completedCommands: CompleteMerchantAlertDispatchCommand[];
  readonly sendCalls: MerchantAlertDeviceDestination[];
}

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
    devices: [DEVICE_ONE],
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

function sentResult(destination: MerchantAlertDeviceDestination): MerchantAlertDeviceResult {
  return {
    deviceId: destination.deviceId,
    outcome: 'SENT',
    providerMessageId: `projects/test/messages/${destination.deviceId}`,
    failureCode: null,
    failureReason: null,
    retryable: false,
  };
}

function dependencies(
  claims: readonly MerchantAlertDispatchClaim[],
  sendImplementation: MerchantAlertSender['send'] = (_claim, destination) =>
    Promise.resolve(sentResult(destination)),
): TestDependencies {
  const completedCommands: CompleteMerchantAlertDispatchCommand[] = [];
  const sendCalls: MerchantAlertDeviceDestination[] = [];

  const gateway: MerchantAlertDeliveryGateway = {
    claimDispatches: () => Promise.resolve(claims),
    completeDispatch: (command) => {
      completedCommands.push(command);
      return Promise.resolve(completion(command));
    },
  };
  const sender: MerchantAlertSender = {
    send: (dispatchClaim, destination) => {
      sendCalls.push(destination);
      return sendImplementation(dispatchClaim, destination);
    },
  };

  return { gateway, sender, completedCommands, sendCalls };
}

function requireFirstCommand(
  commands: readonly CompleteMerchantAlertDispatchCommand[],
): CompleteMerchantAlertDispatchCommand {
  const command = commands.at(0);
  if (command === undefined) throw new Error('Expected a completed dispatch command');
  return command;
}

describe('MerchantAlertDispatchService', () => {
  it('publishes a terminal claim without calling FCM', async () => {
    const stoppedClaim = claim({
      deliverable: false,
      stopReason: 'ORDER_NOT_WAITING',
      devices: [],
    });
    const test = dependencies([stoppedClaim]);
    const service = new MerchantAlertDispatchService(CONFIGURATION, test.gateway, test.sender);

    const summary = await service.drain();

    expect(test.sendCalls).toHaveLength(0);
    expect(test.completedCommands).toEqual([
      {
        workerId: 'worker-one',
        eventId: stoppedClaim.eventId,
        alertId: stoppedClaim.alertId,
        stopReason: 'ORDER_NOT_WAITING',
        results: [],
      },
    ]);
    expect(summary).toMatchObject({ claimed: 1, published: 1, stopped: 1 });
  });

  it('sends every eligible device and completes the durable event once', async () => {
    const activeClaim = claim({ devices: [DEVICE_ONE, DEVICE_TWO] });
    const test = dependencies([activeClaim]);
    const service = new MerchantAlertDispatchService(CONFIGURATION, test.gateway, test.sender);

    const summary = await service.drain();

    expect(test.sendCalls).toEqual([DEVICE_ONE, DEVICE_TWO]);
    expect(test.completedCommands).toHaveLength(1);
    const command = requireFirstCommand(test.completedCommands);
    expect(command.stopReason).toBeNull();
    expect(command.results).toHaveLength(2);
    expect(command.results.every((result) => result.outcome === 'SENT')).toBe(true);
    expect(summary).toMatchObject({ claimed: 1, published: 1, retrying: 0 });
  });

  it('turns an unexpected sender exception into a retryable device result', async () => {
    const activeClaim = claim();
    const failingSend: MerchantAlertSender['send'] = () =>
      Promise.reject(new Error('do not expose token'));
    const test = dependencies([activeClaim], failingSend);
    const service = new MerchantAlertDispatchService(CONFIGURATION, test.gateway, test.sender);

    await service.drain();

    const command = requireFirstCommand(test.completedCommands);
    expect(command.results).toEqual([
      {
        deviceId: DEVICE_ONE.deviceId,
        outcome: 'FAILED',
        providerMessageId: null,
        failureCode: 'Error',
        failureReason: 'Merchant alert sender failed unexpectedly',
        retryable: true,
      },
    ]);
  });
});
