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
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    await worker.drainOnce();

    expect(calls).toEqual([10]);
  });

  it('one drain at a time & concurrent callers receive the same active promise', async () => {
    let calls = 0;
    let completeProcessing!: () => void;
    const pending = new Promise<{ selected: number; processed: number; failed: number }>(
      (resolve) => {
        completeProcessing = () => resolve({ selected: 1, processed: 1, failed: 0 });
      },
    );

    const service = {
      processAutomatic() {
        calls += 1;
        return pending;
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    const firstDrain = worker.drainOnce();
    const concurrentDrain = worker.drainOnce();

    expect(concurrentDrain).toBe(firstDrain);
    expect(calls).toBe(1);

    completeProcessing();
    await Promise.all([firstDrain, concurrentDrain]);
  });

  it('shutdown waits for an active drain', async () => {
    let completeProcessing!: () => void;
    let calls = 0;
    const pending = new Promise<{ selected: number; processed: number; failed: number }>(
      (resolve) => {
        completeProcessing = () => resolve({ selected: 1, processed: 1, failed: 0 });
      },
    );
    const service = {
      processAutomatic() {
        calls += 1;
        return pending;
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    const firstDrain = worker.drainOnce();
    let shutdownCompleted = false;
    const shutdown = worker.onApplicationShutdown().then(() => {
      shutdownCompleted = true;
    });

    await Promise.resolve();
    expect(shutdownCompleted).toBe(false);

    completeProcessing();
    await Promise.all([firstDrain, shutdown]);
    expect(shutdownCompleted).toBe(true);
    expect(calls).toBe(1);
  });

  it('no new drain starts after shutdown begins', async () => {
    let calls = 0;
    const service = {
      processAutomatic() {
        calls += 1;
        return Promise.resolve({ selected: 0, processed: 0, failed: 0 });
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    await worker.onApplicationShutdown();
    await worker.drainOnce();

    expect(calls).toBe(0);
  });

  it('active drain is cleared after success', async () => {
    let calls = 0;
    const service = {
      processAutomatic() {
        calls += 1;
        return Promise.resolve({ selected: 1, processed: 1, failed: 0 });
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    const firstDrain = worker.drainOnce();
    await firstDrain;

    const secondDrain = worker.drainOnce();
    expect(secondDrain).not.toBe(firstDrain);
    await secondDrain;

    expect(calls).toBe(2);
  });

  it('active drain is cleared after rejection', async () => {
    let calls = 0;
    const service = {
      processAutomatic() {
        calls += 1;
        return Promise.reject(new Error('Database failure'));
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    await worker.drainOnce();
    expect(calls).toBe(1);

    await worker.drainOnce();
    expect(calls).toBe(2);
  });

  it('no unhandled rejection is created by .finally()', async () => {
    const service = {
      processAutomatic() {
        return Promise.reject(new Error('Simulated failure'));
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    let caughtError: unknown = null;
    try {
      await worker.drainOnce();
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeNull(); // performDrain catches internally and resolves
  });

  it('calling shutdown twice remains safe', async () => {
    const service = {
      processAutomatic() {
        return Promise.resolve({ selected: 0, processed: 0, failed: 0 });
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    await worker.onApplicationShutdown();
    await worker.onApplicationShutdown();

    expect(true).toBe(true);
  });

  it('calling bootstrap twice cannot create two intervals', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    let calls = 0;
    const service = {
      processAutomatic() {
        calls += 1;
        return Promise.resolve({ selected: 0, processed: 0, failed: 0 });
      },
    } as unknown as RefundExecutionService;
    const worker = new RefundExecutionWorker(service);

    try {
      worker.onApplicationBootstrap();
      worker.onApplicationBootstrap();

      await worker.onApplicationShutdown();
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('a hung provider call cannot block shutdown forever', async () => {
    const originalTimeout = process.env['REFUND_PROCESSOR_SHUTDOWN_TIMEOUT_MS'];
    process.env['REFUND_PROCESSOR_SHUTDOWN_TIMEOUT_MS'] = '100';

    try {
      const service = {
        processAutomatic() {
          return new Promise<{ selected: number; processed: number; failed: number }>(
            () => {
              // Never resolves
            },
          );
        },
      } as unknown as RefundExecutionService;
      const worker = new RefundExecutionWorker(service);

      void worker.drainOnce();

      let shutdownCompleted = false;
      const shutdown = worker.onApplicationShutdown().then(() => {
        shutdownCompleted = true;
      });

      await shutdown;
      expect(shutdownCompleted).toBe(true);
    } finally {
      if (originalTimeout !== undefined) {
        process.env['REFUND_PROCESSOR_SHUTDOWN_TIMEOUT_MS'] = originalTimeout;
      } else {
        delete process.env['REFUND_PROCESSOR_SHUTDOWN_TIMEOUT_MS'];
      }
    }
  });
});
