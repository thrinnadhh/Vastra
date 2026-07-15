import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { SupabaseClient } from '../auth/supabase-client.type';
import {
  type MerchantOrderReadyGateway,
  MerchantOrderReadyDataInvalidError,
  MerchantOrderReadyGatewayUnavailableError,
  MerchantOrderReadyInvalidStateError,
  MerchantOrderReadyItemNotVerifiedError,
  MerchantOrderReadyNotFoundError,
  parseMerchantOrderReadyResult,
  SupabaseMerchantOrderReadyGateway,
} from './merchant-order-ready.gateway';
import { MerchantOrderReadyService } from './merchant-order-ready.service';
import type { MerchantOrderReadyResult } from './merchant-order-ready.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';
const READY_AT = '2026-07-16T04:30:00.000Z';
const context = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'test-token',
  supabase: Object.freeze({}),
} as unknown as AuthenticatedRequestContext;

function readyResult(replayed = false): MerchantOrderReadyResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-READY-1',
    status: 'READY_FOR_PICKUP',
    readyAt: READY_AT,
    totalLines: 2,
    packedLines: 2,
    allPacked: true,
    replayed,
  };
}

class StubGateway implements MerchantOrderReadyGateway {
  public error: Error | null = null;
  public result = readyResult();
  public call: readonly string[] | null = null;

  public markReady(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<MerchantOrderReadyResult> {
    this.call = [actorId, orderId, idempotencyKey];
    return this.error === null ? Promise.resolve(this.result) : Promise.reject(this.error);
  }
}

function readError(error: unknown): { readonly status: number; readonly code: string } {
  if (!(error instanceof HttpException)) throw error;
  const response = error.getResponse();
  if (typeof response !== 'object') throw new TypeError('Expected response');
  const apiError = (response as Record<string, unknown>)['error'];
  if (typeof apiError !== 'object' || apiError === null) throw new TypeError('Expected error');
  const code = (apiError as Record<string, unknown>)['code'];
  if (typeof code !== 'string') throw new TypeError('Expected code');
  return { status: error.getStatus(), code };
}

describe('merchant ready-for-pickup service and gateway', () => {
  it('returns the successful ready transition and passes trusted command inputs', async () => {
    const gateway = new StubGateway();
    const response = await new MerchantOrderReadyService(gateway).markReady(
      context,
      ORDER_ID,
      IDEMPOTENCY_KEY,
      {},
    );
    expect(response.data.order).toStrictEqual(readyResult());
    expect(gateway.call).toStrictEqual([ACTOR_ID, ORDER_ID, IDEMPOTENCY_KEY]);
  });

  it('returns a safe replay', async () => {
    const gateway = new StubGateway();
    gateway.result = readyResult(true);
    const response = await new MerchantOrderReadyService(gateway).markReady(
      context,
      ORDER_ID,
      IDEMPOTENCY_KEY,
      undefined,
    );
    expect(response.data.order.replayed).toBe(true);
  });

  it.each([
    ['invalid order', 'invalid', IDEMPOTENCY_KEY, 400, 'VALIDATION_ERROR'],
    ['missing key', ORDER_ID, undefined, 400, 'IDEMPOTENCY_KEY_REQUIRED'],
    ['malformed key', ORDER_ID, 'invalid', 400, 'IDEMPOTENCY_KEY_REQUIRED'],
  ] as const)('maps %s', async (_name, orderId, key, status, code) => {
    const error = await new MerchantOrderReadyService(new StubGateway())
      .markReady(context, orderId, key, {})
      .then(
        () => null,
        (reason: unknown) => reason,
      );
    expect(readError(error)).toStrictEqual({ status, code });
  });

  it.each([
    ['not found', new MerchantOrderReadyNotFoundError(), 404, 'ORDER_NOT_FOUND'],
    ['invalid state', new MerchantOrderReadyInvalidStateError(), 409, 'INVALID_ORDER_STATE'],
    [
      'incomplete verification',
      new MerchantOrderReadyItemNotVerifiedError(),
      409,
      'ORDER_ITEM_NOT_VERIFIED',
    ],
    ['malformed data', new MerchantOrderReadyDataInvalidError(), 500, 'INTERNAL_ERROR'],
    [
      'provider unavailable',
      new MerchantOrderReadyGatewayUnavailableError(),
      503,
      'EXTERNAL_SERVICE_UNAVAILABLE',
    ],
  ] as const)('maps %s', async (_name, gatewayError, status, code) => {
    const gateway = new StubGateway();
    gateway.error = gatewayError;
    const error = await new MerchantOrderReadyService(gateway)
      .markReady(context, ORDER_ID, IDEMPOTENCY_KEY, {})
      .then(
        () => null,
        (reason: unknown) => reason,
      );
    expect(readError(error)).toStrictEqual({ status, code });
  });

  it.each([
    ['missing readyAt', { ...readyResult(), readyAt: null }],
    ['zero total lines', { ...readyResult(), totalLines: 0, packedLines: 0 }],
    ['mismatched packed count', { ...readyResult(), packedLines: 1 }],
    ['not all packed', { ...readyResult(), allPacked: false }],
    ['wrong status', { ...readyResult(), status: 'PACKING' }],
  ])('rejects %s in provider output', (_name, value) => {
    expect(() => parseMerchantOrderReadyResult(value)).toThrow(MerchantOrderReadyDataInvalidError);
  });

  it('calls the exact RPC and maps an undefined provider error code', async () => {
    const calls: unknown[] = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push([name, args]);
        return Promise.resolve({ data: null, error: { code: undefined } });
      },
    } as unknown as SupabaseClient;
    await expect(
      new SupabaseMerchantOrderReadyGateway(client).markReady(ACTOR_ID, ORDER_ID, IDEMPOTENCY_KEY),
    ).rejects.toBeInstanceOf(MerchantOrderReadyGatewayUnavailableError);
    expect(calls).toStrictEqual([
      [
        'mark_merchant_order_ready_for_pickup',
        { p_actor: ACTOR_ID, p_order_id: ORDER_ID, p_idempotency_key: IDEMPOTENCY_KEY },
      ],
    ]);
  });

  it('does not swallow unknown service exceptions', async () => {
    const gateway = new StubGateway();
    const unknownError = new Error('programmer defect');
    gateway.error = unknownError;
    await expect(
      new MerchantOrderReadyService(gateway).markReady(context, ORDER_ID, IDEMPOTENCY_KEY, {}),
    ).rejects.toBe(unknownError);
  });
});
