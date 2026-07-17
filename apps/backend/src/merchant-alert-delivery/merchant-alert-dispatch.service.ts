import { Inject, Injectable, Logger } from '@nestjs/common';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import type {
  CompleteMerchantAlertDispatchResult,
  MerchantAlertDeliveryGateway,
  MerchantAlertDeviceResult,
  MerchantAlertDispatchClaim,
  MerchantAlertDrainSummary,
  MerchantAlertSender,
} from './merchant-alert-delivery.types';
import {
  MERCHANT_ALERT_DELIVERY_CONFIGURATION,
  MERCHANT_ALERT_DELIVERY_GATEWAY,
  MERCHANT_ALERT_SENDER,
} from './merchant-alert-delivery.tokens';

function emptySummary(): MerchantAlertDrainSummary {
  return { claimed: 0, published: 0, retrying: 0, deadLettered: 0, stopped: 0 };
}

function addCompletion(
  summary: MerchantAlertDrainSummary,
  result: CompleteMerchantAlertDispatchResult,
): MerchantAlertDrainSummary {
  return {
    claimed: summary.claimed,
    published: summary.published + (result.eventStatus === 'PUBLISHED' ? 1 : 0),
    retrying: summary.retrying + (result.eventStatus === 'FAILED' ? 1 : 0),
    deadLettered: summary.deadLettered + (result.eventStatus === 'DEAD_LETTER' ? 1 : 0),
    stopped: summary.stopped + (result.stopped ? 1 : 0),
  };
}

function unexpectedSendFailure(deviceId: string, error: unknown): MerchantAlertDeviceResult {
  return {
    deviceId,
    outcome: 'FAILED',
    providerMessageId: null,
    failureCode: error instanceof Error ? error.name : 'UNEXPECTED_SEND_FAILURE',
    failureReason: 'Merchant alert sender failed unexpectedly',
    retryable: true,
  };
}

@Injectable()
export class MerchantAlertDispatchService {
  private readonly logger = new Logger(MerchantAlertDispatchService.name);

  public constructor(
    @Inject(MERCHANT_ALERT_DELIVERY_CONFIGURATION)
    private readonly configuration: MerchantAlertDeliveryConfiguration,
    @Inject(MERCHANT_ALERT_DELIVERY_GATEWAY)
    private readonly gateway: MerchantAlertDeliveryGateway,
    @Inject(MERCHANT_ALERT_SENDER)
    private readonly sender: MerchantAlertSender,
  ) {}

  public async drain(limit = this.configuration.batchSize): Promise<MerchantAlertDrainSummary> {
    const claims = await this.gateway.claimDispatches(this.configuration.workerId, limit);
    let summary: MerchantAlertDrainSummary = { ...emptySummary(), claimed: claims.length };

    for (const claim of claims) {
      const completion = await this.processClaim(claim);
      summary = addCompletion(summary, completion);
      this.logger.log(
        `merchant-alert event=${completion.eventId} alert=${completion.alertId} status=${completion.eventStatus} sent=${String(completion.successfulDevices)} failed=${String(completion.failedDevices)} stopped=${String(completion.stopped)}`,
      );
    }

    return summary;
  }

  private async processClaim(
    claim: MerchantAlertDispatchClaim,
  ): Promise<CompleteMerchantAlertDispatchResult> {
    if (!claim.deliverable) {
      return this.gateway.completeDispatch({
        workerId: this.configuration.workerId,
        eventId: claim.eventId,
        alertId: claim.alertId,
        stopReason: claim.stopReason,
        results: [],
      });
    }

    const results = await Promise.all(
      claim.devices.map(async (destination) => {
        try {
          return await this.sender.send(claim, destination);
        } catch (error: unknown) {
          return unexpectedSendFailure(destination.deviceId, error);
        }
      }),
    );

    return this.gateway.completeDispatch({
      workerId: this.configuration.workerId,
      eventId: claim.eventId,
      alertId: claim.alertId,
      stopReason: null,
      results,
    });
  }
}
