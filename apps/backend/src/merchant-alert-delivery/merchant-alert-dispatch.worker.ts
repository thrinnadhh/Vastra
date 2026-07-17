import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import { MERCHANT_ALERT_DELIVERY_CONFIGURATION } from './merchant-alert-delivery.tokens';
import { MerchantAlertDispatchService } from './merchant-alert-dispatch.service';

@Injectable()
export class MerchantAlertDispatchWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MerchantAlertDispatchWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  public constructor(
    @Inject(MERCHANT_ALERT_DELIVERY_CONFIGURATION)
    private readonly configuration: MerchantAlertDeliveryConfiguration,
    private readonly dispatchService: MerchantAlertDispatchService,
  ) {}

  public onApplicationBootstrap(): void {
    if (!this.configuration.enabled) {
      this.logger.log('merchant-alert delivery worker disabled');
      return;
    }

    void this.drainOnce();
    this.timer = setInterval(() => void this.drainOnce(), this.configuration.pollIntervalMs);
    this.timer.unref();
  }

  public onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  public async drainOnce(): Promise<void> {
    if (this.draining || !this.configuration.enabled) return;
    this.draining = true;

    try {
      await this.dispatchService.drain();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      this.logger.warn(`merchant-alert delivery drain failed reason=${reason}`);
    } finally {
      this.draining = false;
    }
  }
}
