import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { PaymentEventRetryResult, PaymentProcessingSummary } from './payment-processing.types';

export interface PaymentProcessingGateway {
  processBatch(limit: number): Promise<PaymentProcessingSummary>;
  retryFailedEvent(
    actorId: string,
    eventId: number,
    idempotencyKey: string,
    note: string | null,
  ): Promise<PaymentEventRetryResult>;
}

export class PaymentProcessingGatewayUnavailableError extends Error {}
export class PaymentProcessingStateConflictError extends Error {}
export class PaymentProcessingIdempotencyConflictError extends Error {}
export class PaymentProcessingNotFoundError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentProcessingGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new PaymentProcessingGatewayUnavailableError();
  }
  return value;
}

@Injectable()
export class SupabasePaymentProcessingGateway implements PaymentProcessingGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new PaymentProcessingIdempotencyConflictError();
    }
    if (message.includes('FINANCE_PAYMENT_STATE_CONFLICT')) {
      throw new PaymentProcessingStateConflictError();
    }
    if (message.includes('FINANCE_PAYMENT_NOT_FOUND')) {
      throw new PaymentProcessingNotFoundError();
    }
    throw new PaymentProcessingGatewayUnavailableError();
  }

  public async processBatch(limit: number): Promise<PaymentProcessingSummary> {
    const { data, error } = await this.client.rpc('process_verified_payment_events', {
      p_limit: limit,
    });
    if (error !== null) this.mapError(error.message);
    const record = requireRecord(data);
    return {
      selected: requireNumber(record, 'selected'),
      processed: requireNumber(record, 'processed'),
      ignored: requireNumber(record, 'ignored'),
      failed: requireNumber(record, 'failed'),
    };
  }

  public async retryFailedEvent(
    actorId: string,
    eventId: number,
    idempotencyKey: string,
    note: string | null,
  ): Promise<PaymentEventRetryResult> {
    const { data, error } = await this.client.rpc('admin_retry_payment_event', {
      p_actor_id: actorId,
      p_event_id: eventId,
      p_idempotency_key: idempotencyKey,
      p_note: note,
    });
    if (error !== null) this.mapError(error.message);
    const record = requireRecord(data);
    if (
      typeof record['eventId'] !== 'string' ||
      typeof record['paymentId'] !== 'string' ||
      record['processingStatus'] !== 'RECEIVED' ||
      typeof record['replayed'] !== 'boolean'
    ) {
      throw new PaymentProcessingGatewayUnavailableError();
    }
    return {
      eventId: record['eventId'],
      paymentId: record['paymentId'],
      processingStatus: 'RECEIVED',
      replayed: record['replayed'],
    };
  }
}
