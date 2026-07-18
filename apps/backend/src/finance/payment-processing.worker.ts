import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { PaymentProcessingService } from './payment-processing.service';

@Injectable()
export class PaymentProcessingWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PaymentProcessingWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  public constructor(private readonly service: PaymentProcessingService) {}

  public onApplicationBootstrap(): void {
    if (
      process.env['NODE_ENV'] === 'test' ||
      process.env['PAYMENT_EVENT_PROCESSOR_ENABLED'] === 'false'
    ) {
      return;
    }
    void this.drainOnce();
    this.timer = setInterval(() => void this.drainOnce(), 5_000);
    this.timer.unref();
  }

  public onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  public async drainOnce(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      await this.service.process(25);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      this.logger.warn(`payment event processing failed reason=${reason}`);
    } finally {
      this.draining = false;
    }
  }
}
