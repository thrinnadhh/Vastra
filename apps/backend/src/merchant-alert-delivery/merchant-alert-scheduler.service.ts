import { Inject, Injectable, Logger } from '@nestjs/common';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import {
  MERCHANT_ALERT_DELIVERY_CONFIGURATION,
  MERCHANT_ALERT_SCHEDULER_GATEWAY,
} from './merchant-alert-delivery.tokens';
import type {
  MerchantAlertSchedulerGateway,
  MerchantAlertScheduleSummary,
} from './merchant-alert-scheduler.types';

@Injectable()
export class MerchantAlertSchedulerService {
  private readonly logger = new Logger(MerchantAlertSchedulerService.name);

  public constructor(
    @Inject(MERCHANT_ALERT_DELIVERY_CONFIGURATION)
    private readonly configuration: MerchantAlertDeliveryConfiguration,
    @Inject(MERCHANT_ALERT_SCHEDULER_GATEWAY)
    private readonly gateway: MerchantAlertSchedulerGateway,
  ) {}

  public async processDue(limit = this.configuration.batchSize): Promise<MerchantAlertScheduleSummary> {
    const summary = await this.gateway.processDueAlerts(this.configuration.workerId, limit);
    if (summary.processed > 0) {
      this.logger.log(
        `merchant-alert schedule processed=${String(summary.processed)} reminders=${String(summary.remindersQueued)} expired=${String(summary.expired)} stopped=${String(summary.stopped)}`,
      );
    }
    return summary;
  }
}
