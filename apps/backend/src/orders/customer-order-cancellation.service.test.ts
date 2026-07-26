import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerOrderCancellationGateway,
  CustomerOrderAlreadyCancelledError,
  CustomerOrderCancellationDataInvalidError,
  CustomerOrderCancellationGatewayUnavailableError,
  CustomerOrderCancellationIdempotencyConflictError,
  CustomerOrderCancellationNotAllowedError,
  CustomerOrderCancellationNotFoundError,
} from './customer-order-cancellation.gateway';
import { CustomerOrderCancellationService } from './customer-order-cancellation.service';
import type { CustomerOrderCancellationResult } from './customer-order-cancellation.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';
const CONTEXT = {
  actor: { id: ACTOR_ID },
} as AuthenticatedRequestContext;

function cancellation(): CustomerOrderCancellationResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-CANCEL-1',
    status: 'CANCELLED',
    paymentStatus: 'COD_PENDING',
    refundId: null,
    refundStatus: null,
    reservationsReleased: 1,
    cancelledAt: '2026-07-26T10:00:00.000Z',
    replayed: false,
  };
}

class StubGateway implements CustomerOrderCancellationGateway {
  public actorId: string | null = null;
  public orderId: string | null = null;
  public idempotencyKey: string | null = null;
  public error: Error | null = null;

  public cancel(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<CustomerOrderCancellationResult> {
    this.actorId = actorId;
    this.orderId = orderId;
    this.idempotencyKey = idempotencyKey;
    return this.error === null ? Promise.resolve(cancellation()) : Promise.reject(this.error);
  }
}

function readCode(error: HttpException): string {
  const response = error.getResponse() as {
    readonly error: { readonly code: string };
  };
  return response.error.code;
}

async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('Expected an HttpException');
}

describe('CustomerOrderCancellationService', () => {
  let gateway: StubGateway;
  let service: CustomerOrderCancellationService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerOrderCancellationService(gateway);
  });

  it('cancels a customer-owned order with the idempotency key', async () => {
    const response = await service.cancel(CONTEXT, ORDER_ID, IDEMPOTENCY_KEY);

    expect(response.data.cancellation.status).toBe('CANCELLED');
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.orderId).toBe(ORDER_ID);
    expect(gateway.idempotencyKey).toBe(IDEMPOTENCY_KEY);
  });

  it.each([
    [new CustomerOrderCancellationNotFoundError(), 404, 'ORDER_NOT_FOUND'],
    [new CustomerOrderAlreadyCancelledError(), 409, 'ORDER_ALREADY_CANCELLED'],
    [new CustomerOrderCancellationNotAllowedError(), 409, 'ORDER_CANCELLATION_NOT_ALLOWED'],
    [new CustomerOrderCancellationIdempotencyConflictError(), 409, 'IDEMPOTENCY_CONFLICT'],
    [new CustomerOrderCancellationDataInvalidError(), 500, 'INTERNAL_ERROR'],
    [new CustomerOrderCancellationGatewayUnavailableError(), 503, 'EXTERNAL_SERVICE_UNAVAILABLE'],
  ])('maps cancellation domain errors', async (gatewayError, status, code) => {
    gateway.error = gatewayError;

    const error = await captureHttpException(service.cancel(CONTEXT, ORDER_ID, IDEMPOTENCY_KEY));

    expect(error.getStatus()).toBe(status);
    expect(readCode(error)).toBe(code);
  });
});
