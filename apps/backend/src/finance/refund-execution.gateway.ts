import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  RefundExecutionCommandInput,
  RefundExecutionRecord,
} from './refund-execution.types';

export interface RefundExecutionGateway {
  list(status: string | null, limit: number): Promise<readonly RefundExecutionRecord[]>;
  get(refundId: string): Promise<RefundExecutionRecord | null>;
  prepare(
    actorId: string,
    returnId: string,
    input: RefundExecutionCommandInput,
  ): Promise<RefundExecutionRecord>;
  markRetrying(actorId: string, refundId: string): Promise<RefundExecutionRecord>;
  applyProviderResult(
    actorId: string,
    refundId: string,
    providerRefundId: string,
    providerStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
    processedAt: string | null,
    failureMessage: string | null,
  ): Promise<RefundExecutionRecord>;
}

export class RefundExecutionGatewayUnavailableError extends Error {}
export class RefundExecutionNotFoundError extends Error {}
export class RefundExecutionStateConflictError extends Error {}
export class RefundExecutionAmountConflictError extends Error {}
export class RefundExecutionIdempotencyConflictError extends Error {}

function requireRecord(value: unknown): RefundExecutionRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RefundExecutionGatewayUnavailableError();
  }
  return value as RefundExecutionRecord;
}

@Injectable()
export class SupabaseRefundExecutionGateway implements RefundExecutionGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new RefundExecutionIdempotencyConflictError();
    }
    if (message.includes('FINANCE_REFUND_AMOUNT_CONFLICT')) {
      throw new RefundExecutionAmountConflictError();
    }
    if (
      message.includes('FINANCE_REFUND_STATE_CONFLICT') ||
      message.includes('FINANCE_RETURN_STATE_CONFLICT')
    ) {
      throw new RefundExecutionStateConflictError();
    }
    if (
      message.includes('FINANCE_REFUND_NOT_FOUND') ||
      message.includes('FINANCE_RETURN_NOT_FOUND')
    ) {
      throw new RefundExecutionNotFoundError();
    }
    throw new RefundExecutionGatewayUnavailableError();
  }

  public async list(
    status: string | null,
    limit: number,
  ): Promise<readonly RefundExecutionRecord[]> {
    const { data, error } = await this.client.rpc('list_admin_refunds', {
      p_status: status,
      p_limit: limit,
    });
    if (error !== null) this.mapError(error.message);
    if (!Array.isArray(data)) throw new RefundExecutionGatewayUnavailableError();
    return data.map(requireRecord);
  }

  public async get(refundId: string): Promise<RefundExecutionRecord | null> {
    const { data, error } = await this.client.rpc('get_admin_refund', {
      p_refund_id: refundId,
    });
    if (error !== null) this.mapError(error.message);
    return data === null ? null : requireRecord(data);
  }

  public async prepare(
    actorId: string,
    returnId: string,
    input: RefundExecutionCommandInput,
  ): Promise<RefundExecutionRecord> {
    const { data, error } = await this.client.rpc('prepare_return_refund', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async markRetrying(
    actorId: string,
    refundId: string,
  ): Promise<RefundExecutionRecord> {
    const { data, error } = await this.client.rpc('mark_refund_retrying', {
      p_actor_id: actorId,
      p_refund_id: refundId,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async applyProviderResult(
    actorId: string,
    refundId: string,
    providerRefundId: string,
    providerStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
    processedAt: string | null,
    failureMessage: string | null,
  ): Promise<RefundExecutionRecord> {
    const { data, error } = await this.client.rpc('apply_return_refund_result', {
      p_actor_id: actorId,
      p_refund_id: refundId,
      p_provider_refund_id: providerRefundId,
      p_provider_status: providerStatus,
      p_processed_at: processedAt,
      p_failure_message: failureMessage,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }
}
