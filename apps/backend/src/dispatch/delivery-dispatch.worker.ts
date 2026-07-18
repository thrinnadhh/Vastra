import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { DeliveryDispatchConfiguration } from './delivery-dispatch.configuration';
import type { DeliveryGateway } from './delivery.gateway';
import { DELIVERY_DISPATCH_CONFIGURATION, DELIVERY_GATEWAY } from './delivery.tokens';

@Injectable()
export class DeliveryDispatchWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DeliveryDispatchWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  public constructor(
    @Inject(DELIVERY_DISPATCH_CONFIGURATION)
    private readonly configuration: DeliveryDispatchConfiguration,
    @Inject(DELIVERY_GATEWAY)
    private readonly gateway: DeliveryGateway,
  ) {}

  public onApplicationBootstrap(): void {
    if (!this.configuration.enabled) {
      this.logger.log('delivery dispatch worker disabled');
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
    if (!this.configuration.enabled || this.draining) return;
    this.draining = true;
    try {
      const result = await this.gateway.runDispatchCycle({
        workerId: this.configuration.workerId,
        limit: this.configuration.dueTaskLimit,
        initialRadiusMeters: this.configuration.initialRadiusMeters,
        radiusStepMeters: this.configuration.radiusStepMeters,
        maxRadiusMeters: this.configuration.maxRadiusMeters,
        captainsPerWave: this.configuration.captainsPerWave,
        offerLifetimeSeconds: this.configuration.offerLifetimeSeconds,
        waveIntervalSeconds: this.configuration.waveIntervalSeconds,
      });
      const created = result.taskResults.reduce(
        (total, taskResult) => total + taskResult.offersCreated,
        0,
      );
      const expired = result.taskResults.reduce(
        (total, taskResult) => total + taskResult.offersExpired,
        0,
      );
      if (
        result.dispatchesStarted > 0 ||
        result.taskResults.length > 0 ||
        result.dispatchFailures.length > 0
      ) {
        this.logger.log(
          `delivery dispatch workerId=${result.workerId} dispatchesStarted=${String(result.dispatchesStarted)} tasks=${String(result.taskResults.length)} offersCreated=${String(created)} offersExpired=${String(expired)} failures=${String(result.dispatchFailures.length)}`,
        );
      }
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      this.logger.warn(`delivery dispatch drain failed reason=${reason}`);
    } finally {
      this.draining = false;
    }
  }
}
