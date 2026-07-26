import { describe, expect, it } from 'vitest';

import type { RefundExecutionService } from './refund-execution.service';
import { RefundExecutionWorker } from './refund-execution.worker';

describe('RefundExecutionWorker', () => {
  it('drains the bounded automatic refund queue', async () => {
    const calls: number[] = [];
    const service = {
      processAutomatic(limit: number) {
        calls.push(limit);
        return Promise.resolve({ selected: 1, processed: 1, failed: 0 });
      },
    } as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    await worker.drainOnce();

    expect(calls).toEqual([10]);
  });
});
