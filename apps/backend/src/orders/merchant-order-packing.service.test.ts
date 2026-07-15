import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOrderPackingGateway,
  MerchantOrderPackingConflictError,
  MerchantOrderPackingDataInvalidError,
  MerchantOrderPackingGatewayUnavailableError,
  MerchantOrderPackingInvalidStateError,
  MerchantOrderPackingNotFoundError,
} from './merchant-order-packing.gateway';
import { MerchantOrderPackingService } from './merchant-order-packing.service';
import type {
  MerchantOrderItemVerificationInput,
  MerchantOrderItemVerificationResultData,
  MerchantOrderPackingList,
  MerchantOrderStartPackingResult,
} from './merchant-order-packing.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '30000000-0000-4000-8000-000000000001';
const VERIFIED_AT = '2026-07-16T03:30:00.000Z';
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

function startResult(replayed = false): MerchantOrderStartPackingResult {
  return { orderId: ORDER_ID, orderNumber: 'VAS-PACK-1', status: 'PACKING', replayed };
}

function packingList(): MerchantOrderPackingList {
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-PACK-1',
    status: 'PACKING',
    totalLines: 1,
    verifiedLines: 0,
    allVerified: false,
    items: [
      {
        orderItemId: ITEM_ID,
        productName: 'Blue Kurta',
        sku: 'KURTA-BLUE-M',
        colour: 'Blue',
        size: 'M',
        imageObjectKey: 'products/blue-kurta.webp',
        quantity: 2,
        fulfilmentStatus: 'PENDING',
        verification: null,
      },
    ],
  };
}

function verification(
  method: 'BARCODE' | 'MANUAL' = 'BARCODE',
  result: 'MATCH' | 'MISMATCH' = 'MATCH',
): MerchantOrderItemVerificationResultData {
  const verified = result === 'MATCH';
  return {
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    fulfilmentStatus: verified ? 'VERIFIED' : 'PENDING',
    method,
    result,
    scannedBarcode: method === 'BARCODE' ? 'AbC-123' : null,
    verified,
    verifiedAt: VERIFIED_AT,
    totalLines: 1,
    verifiedLines: verified ? 1 : 0,
    allVerified: verified,
    replayed: false,
  };
}

class StubGateway implements MerchantOrderPackingGateway {
  public error: Error | null = null;
  public started = startResult();
  public list = packingList();
  public verified = verification();
  public lastInput: MerchantOrderItemVerificationInput | null = null;

  private result<T>(value: T): Promise<T> {
    return this.error === null ? Promise.resolve(value) : Promise.reject(this.error);
  }

  public startPacking(actorId: string, orderId: string): Promise<MerchantOrderStartPackingResult> {
    void actorId;
    void orderId;
    return this.result(this.started);
  }

  public getPackingList(actorId: string, orderId: string): Promise<MerchantOrderPackingList> {
    void actorId;
    void orderId;
    return this.result(this.list);
  }

  public verifyItem(
    actorId: string,
    orderId: string,
    orderItemId: string,
    input: MerchantOrderItemVerificationInput,
  ): Promise<MerchantOrderItemVerificationResultData> {
    void actorId;
    void orderId;
    void orderItemId;
    this.lastInput = input;
    return this.result(this.verified);
  }
}

function readError(error: unknown): { readonly status: number; readonly code: string } {
  if (!(error instanceof HttpException)) throw error;
  const response = error.getResponse();
  if (typeof response !== 'object') throw new TypeError('Expected response');
  const payload = response as Record<string, unknown>;
  const apiError = payload['error'];
  if (typeof apiError !== 'object' || apiError === null) throw new TypeError('Expected error');
  const code = (apiError as Record<string, unknown>)['code'];
  if (typeof code !== 'string') throw new TypeError('Expected code');
  return { status: error.getStatus(), code };
}

describe('merchant order packing service', () => {
  it('starts packing and preserves the first-command marker', async () => {
    const response = await new MerchantOrderPackingService(new StubGateway()).startPacking(
      context,
      ORDER_ID,
      {},
    );
    expect(response.data.order).toStrictEqual(startResult());
  });

  it('returns the replayed start-packing result', async () => {
    const gateway = new StubGateway();
    gateway.started = startResult(true);
    expect(
      (await new MerchantOrderPackingService(gateway).startPacking(context, ORDER_ID, {})).data
        .order.replayed,
    ).toBe(true);
  });

  it('returns the packing checklist', async () => {
    expect(
      (await new MerchantOrderPackingService(new StubGateway()).getPackingList(context, ORDER_ID))
        .data.packingList,
    ).toStrictEqual(packingList());
  });

  it('verifies a barcode and preserves case after trimming', async () => {
    const gateway = new StubGateway();
    const response = await new MerchantOrderPackingService(gateway).verifyItem(
      context,
      ORDER_ID,
      ITEM_ID,
      { method: 'BARCODE', barcode: ' AbC-123 ' },
    );
    expect(gateway.lastInput).toStrictEqual({ method: 'BARCODE', barcode: 'AbC-123' });
    expect(response.data.verification.verified).toBe(true);
  });

  it('verifies a manual confirmation', async () => {
    const gateway = new StubGateway();
    gateway.verified = verification('MANUAL');
    const response = await new MerchantOrderPackingService(gateway).verifyItem(
      context,
      ORDER_ID,
      ITEM_ID,
      { method: 'MANUAL' },
    );
    expect(gateway.lastInput).toStrictEqual({ method: 'MANUAL' });
    expect(response.data.verification.method).toBe('MANUAL');
  });

  it('returns barcode mismatch as a successful operational result', async () => {
    const gateway = new StubGateway();
    gateway.verified = verification('BARCODE', 'MISMATCH');
    const response = await new MerchantOrderPackingService(gateway).verifyItem(
      context,
      ORDER_ID,
      ITEM_ID,
      { method: 'BARCODE', barcode: 'AbC-123' },
    );
    expect(response.success).toBe(true);
    expect(response.data.verification).toMatchObject({ result: 'MISMATCH', verified: false });
  });

  it('maps invalid identifiers to validation errors', async () => {
    const service = new MerchantOrderPackingService(new StubGateway());
    const error = await service.getPackingList(context, 'invalid').then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(readError(error)).toStrictEqual({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it.each([
    ['not found', new MerchantOrderPackingNotFoundError(), 404, 'ORDER_NOT_FOUND'],
    ['invalid state', new MerchantOrderPackingInvalidStateError(), 409, 'INVALID_ORDER_STATE'],
    ['replay conflict', new MerchantOrderPackingConflictError(), 409, 'IDEMPOTENCY_CONFLICT'],
    ['malformed RPC data', new MerchantOrderPackingDataInvalidError(), 500, 'INTERNAL_ERROR'],
    [
      'provider unavailable',
      new MerchantOrderPackingGatewayUnavailableError(),
      503,
      'EXTERNAL_SERVICE_UNAVAILABLE',
    ],
  ] as const)('maps %s', async (_name, gatewayError, status, code) => {
    const gateway = new StubGateway();
    gateway.error = gatewayError;
    const service = new MerchantOrderPackingService(gateway);
    const error = await service.getPackingList(context, ORDER_ID).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(readError(error)).toStrictEqual({ status, code });
  });

  it('does not swallow unknown exceptions', async () => {
    const gateway = new StubGateway();
    const unknownError = new Error('programmer defect');
    gateway.error = unknownError;
    await expect(
      new MerchantOrderPackingService(gateway).getPackingList(context, ORDER_ID),
    ).rejects.toBe(unknownError);
  });
});
