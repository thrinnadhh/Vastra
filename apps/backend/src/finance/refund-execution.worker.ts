import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { RefundExecutionService } from './refund-execution.service';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 10;

function parseBoundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }
  return value;
}

@Injectable()
export class RefundExecutionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RefundExecutionWorker.name);
  private readonly pollIntervalMs = parseBoundedInteger(
    'REFUND_PROCESSOR_POLL_INTERVAL_MS',
    DEFAULT_POLL_INTERVAL_MS,
    1_000,
    60_000,
  );
  private readonly batchSize = parseBoundedInteger(
    'REFUND_PROCESSOR_BATCH_SIZE',
    DEFAULT_BATCH_SIZE,
    1,
    100,
  );
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  public constructor(private readonly service: RefundExecutionService) {}

  public onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test' || process.env['REFUND_PROCESSOR_ENABLED'] === 'false') {
      return;
    }
    void this.drainOnce();
    this.timer = setInterval(() => void this.drainOnce(), this.pollIntervalMs);
    this.timer.unref();
  }

  public onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  public async drainOnce(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const result = await this.service.processAutomatic(this.batchSize);
      if (result.selected > 0) {
        this.logger.log(
          `automatic refund drain selected=${String(result.selected)} processed=${String(result.processed)} failed=${String(result.failed)}`,
        );
      }
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      this.logger.warn(`automatic refund drain failed reason=${reason}`);
    } finally {
      this.draining = false;
    }
  }
}
