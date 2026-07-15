import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { WardrobeGateway } from './wardrobe.gateway';
import { isRecord, requireString, WardrobeDataInvalidError } from './wardrobe-item.parser';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

const RETRY_INTERVAL_MS = 60_000;

@Injectable()
export class WardrobeStorageDeletionProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public onApplicationBootstrap(): void {
    void this.drain(10);
    this.timer = setInterval(() => void this.drain(10), RETRY_INTERVAL_MS);
    this.timer.unref();
  }

  public onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  public async drain(limit: number): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let count = 0; count < limit; count += 1) {
        const value = await this.gateway.execute('claim_wardrobe_deletion_job', {});
        if (value === null) return;
        if (!isRecord(value)) throw new WardrobeDataInvalidError();
        const jobId = requireString(value, 'jobId');
        const objectKey = requireString(value, 'objectKey');
        try {
          await this.gateway.removeObject(objectKey);
          await this.gateway.execute('complete_wardrobe_deletion_job', { p_job_id: jobId });
        } catch {
          await this.gateway.execute('fail_wardrobe_deletion_job', {
            p_job_id: jobId,
            p_error_code: 'STORAGE_DELETE_FAILED',
          });
        }
      }
    } catch {
      // The durable queue remains unchanged and will be retried on the next interval.
    } finally {
      this.draining = false;
    }
  }
}
