import { describe, expect, it } from 'vitest';

import {
  type OrderDispatchGateway,
  OrderDispatchDataInvalidError,
  OrderDispatchGatewayUnavailableError,
  OrderDispatchIdempotencyConflictError,
  OrderDispatchInvalidStateError,
  OrderDispatchNotFoundError,
  parseStartOrderDispatchResult,
} from './order-dispatch.gateway';
import { OrderDispatchService } from './order-dispatch.service';
import type { StartOrderDispatchInput, StartOrderDispatchResult } from './order-dispatch.types';
import { OrderDispatchValidationError } from './order-dispatch.validation';

const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const TASK_ID = '40000000-0000-4000-8000-000000000001';

function result(replayed = false): StartOrderDispatchResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-DISPATCH-1',
    deliveryTaskId: TASK_ID,
    orderStatus: 'CAPTAIN_SEARCHING',
    deliveryTaskStatus: 'SEARCHING',
    taskType: 'FORWARD_DELIVERY',
    startedAt: '2026-07-16T05:30:00.000Z',
    replayed,
  };
}

class StubGateway implements OrderDispatchGateway {
  public calls: StartOrderDispatchInput[] = [];
  public response = result();
  public error: Error | null = null;
  public start(input: StartOrderDispatchInput): Promise<StartOrderDispatchResult> {
    this.calls.push(input);
    return this.error === null ? Promise.resolve(this.response) : Promise.reject(this.error);
  }
}

describe('order dispatch service', () => {
  it('starts a fresh dispatch with exactly one gateway call', async () => {
    const gateway = new StubGateway();
    await expect(
      new OrderDispatchService(gateway).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).resolves.toStrictEqual(result());
    expect(gateway.calls).toStrictEqual([{ orderId: ORDER_ID, idempotencyKey: KEY }]);
  });

  it('returns a safe replay', async () => {
    const gateway = new StubGateway();
    gateway.response = result(true);
    await expect(
      new OrderDispatchService(gateway).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).resolves.toMatchObject({ deliveryTaskId: TASK_ID, replayed: true });
  });

  it('does not call the gateway for invalid input', async () => {
    const gateway = new StubGateway();
    await expect(
      new OrderDispatchService(gateway).start({ orderId: 'bad', idempotencyKey: KEY }),
    ).rejects.toBeInstanceOf(OrderDispatchValidationError);
    expect(gateway.calls).toHaveLength(0);
  });

  it.each([
    new OrderDispatchIdempotencyConflictError(),
    new OrderDispatchNotFoundError(),
    new OrderDispatchInvalidStateError(),
    new OrderDispatchDataInvalidError(),
    new OrderDispatchGatewayUnavailableError(),
  ])('propagates normalized gateway error %#', async (error) => {
    const gateway = new StubGateway();
    gateway.error = error;
    await expect(
      new OrderDispatchService(gateway).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).rejects.toBe(error);
  });

  it.each([
    null,
    { ...result(), deliveryTaskId: 'bad' },
    { ...result(), orderStatus: 'READY_FOR_PICKUP' },
    { ...result(), startedAt: 'never' },
  ])('rejects malformed gateway payload %#', (value) => {
    expect(() => parseStartOrderDispatchResult(value)).toThrow(OrderDispatchDataInvalidError);
  });
});
