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

  it('waits for an in-flight drain and prevents new work during shutdown', async () => {
    let completeProcessing!: () => void;
    let calls = 0;
    const pending = new Promise<{ selected: number; processed: number; failed: number }>((resolve) => {
      completeProcessing = () => resolve({ selected: 1, processed: 1, failed: 0 });
    });
    const service = {
      processAutomatic() {
        calls += 1;
        return pending;
      },
    } as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    const firstDrain = worker.drainOnce();
    const concurrentDrain = worker.drainOnce();
    let shutdownCompleted = false;
    const shutdown = worker.onApplicationShutdown().then(() => {
      shutdownCompleted = true;
    });

    await Promise.resolve();

    expect(concurrentDrain).toBe(firstDrain);
    expect(calls).toBe(1);
    expect(shutdownCompleted).toBe(false);

    completeProcessing();
    await Promise.all([firstDrain, concurrentDrain, shutdown]);
    await worker.drainOnce();

    expect(shutdownCompleted).toBe(true);
    expect(calls).toBe(1);
  });
});
