import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  CUSTOMER_ORDER_PAYMENT_STATUSES,
  type CustomerOrderPaymentStatus,
} from './customer-order-read.types';
import type { CustomerOrderCancellationResult } from './customer-order-cancellation.types';

export interface CustomerOrderCancellationGateway {
  cancel(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<CustomerOrderCancellationResult>;
}

export class CustomerOrderCancellationNotFoundError extends Error {}
export class CustomerOrderAlreadyCancelledError extends Error {}
export class CustomerOrderCancellationNotAllowedError extends Error {}
export class CustomerOrderCancellationIdempotencyConflictError extends Error {}
export class CustomerOrderCancellationDataInvalidError extends Error {}
export class CustomerOrderCancellationGatewayUnavailableError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return value;
}

function requirePaymentStatus(record: Record<string, unknown>): CustomerOrderPaymentStatus {
  const value = record['paymentStatus'];
  if (
    typeof value !== 'string' ||
    !CUSTOMER_ORDER_PAYMENT_STATUSES.some((candidate) => candidate === value)
  ) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return value as CustomerOrderPaymentStatus;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return value;
}

function parseCancellation(value: unknown): CustomerOrderCancellationResult {
  const record = requireRecord(value);
  if (record['status'] !== 'CANCELLED' || typeof record['replayed'] !== 'boolean') {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  const refundStatus = record['refundStatus'];
  if (refundStatus !== null && refundStatus !== 'INITIATED') {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  const cancelledAt = requireString(record, 'cancelledAt');
  if (Number.isNaN(Date.parse(cancelledAt))) {
    throw new CustomerOrderCancellationDataInvalidError();
  }
  return {
    orderId: requireString(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    status: 'CANCELLED',
    paymentStatus: requirePaymentStatus(record),
    refundId: requireNullableString(record, 'refundId'),
    refundStatus,
    reservationsReleased: requireNonNegativeInteger(record, 'reservationsReleased'),
    cancelledAt,
    replayed: record['replayed'],
  };
}

function mapGatewayError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0033':
      return new CustomerOrderCancellationNotFoundError();
    case 'P0034':
    case 'P0038':
      return new CustomerOrderCancellationNotAllowedError();
    case 'P0035':
      return new CustomerOrderAlreadyCancelledError();
    case 'P0036':
      return new CustomerOrderCancellationIdempotencyConflictError();
    default:
      return new CustomerOrderCancellationGatewayUnavailableError();
  }
}

function isKnownCancellationError(error: unknown): boolean {
  return (
    error instanceof CustomerOrderCancellationNotFoundError ||
    error instanceof CustomerOrderAlreadyCancelledError ||
    error instanceof CustomerOrderCancellationNotAllowedError ||
    error instanceof CustomerOrderCancellationIdempotencyConflictError ||
    error instanceof CustomerOrderCancellationDataInvalidError ||
    error instanceof CustomerOrderCancellationGatewayUnavailableError
  );
}

@Injectable()
export class SupabaseCustomerOrderCancellationGateway
  implements CustomerOrderCancellationGateway
{
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async cancel(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<CustomerOrderCancellationResult> {
    try {
      const response = await this.client.rpc('cancel_customer_order', {
        p_actor_id: actorId,
        p_order_id: orderId,
        p_idempotency_key: idempotencyKey,
      });
      if (response.error !== null) throw mapGatewayError(response.error);
      return parseCancellation(response.data);
    } catch (error: unknown) {
      if (isKnownCancellationError(error)) throw error;
      throw new CustomerOrderCancellationGatewayUnavailableError();
    }
  }
}
