import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { AdminMutationReasonCode } from './admin.types';

export type AdminOperationResult = Readonly<Record<string, unknown>>;

export interface AdminOperationInput {
  readonly actorId: string;
  readonly resourceId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminResetVerificationInput extends AdminOperationInput {
  readonly verificationKind: 'PICKUP_CODE' | 'DELIVERY_OTP';
}

export interface AdminOrderOperationsGateway {
  cancelOrder(input: AdminOperationInput): Promise<AdminOperationResult>;
  retryDispatch(input: AdminOperationInput): Promise<AdminOperationResult>;
  releaseDelivery(input: AdminOperationInput): Promise<AdminOperationResult>;
  resetVerification(input: AdminResetVerificationInput): Promise<AdminOperationResult>;
}

export class AdminOrderOperationGatewayUnavailableError extends Error {}
export class AdminOrderOperationConflictError extends Error {}
export class AdminOrderOperationNotFoundError extends Error {}
export class AdminOrderOperationIdempotencyConflictError extends Error {}

function requireResult(data: unknown): AdminOperationResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AdminOrderOperationGatewayUnavailableError();
  }
  return data as AdminOperationResult;
}

@Injectable()
export class SupabaseAdminOrderOperationsGateway implements AdminOrderOperationsGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<AdminOperationResult> {
    const { data, error } = await this.client.rpc(name, args);
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminOrderOperationIdempotencyConflictError();
      }
      if (error.message.includes('NOT_FOUND')) throw new AdminOrderOperationNotFoundError();
      if (error.message.includes('STATE_CONFLICT')) throw new AdminOrderOperationConflictError();
      throw new AdminOrderOperationGatewayUnavailableError();
    }
    return requireResult(data);
  }

  public cancelOrder(input: AdminOperationInput): Promise<AdminOperationResult> {
    return this.rpc('admin_cancel_order_operation', {
      p_actor_id: input.actorId,
      p_order_id: input.resourceId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public retryDispatch(input: AdminOperationInput): Promise<AdminOperationResult> {
    return this.rpc('admin_retry_order_dispatch', {
      p_actor_id: input.actorId,
      p_order_id: input.resourceId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public releaseDelivery(input: AdminOperationInput): Promise<AdminOperationResult> {
    return this.rpc('admin_release_delivery_operation', {
      p_actor_id: input.actorId,
      p_delivery_task_id: input.resourceId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public resetVerification(input: AdminResetVerificationInput): Promise<AdminOperationResult> {
    return this.rpc('admin_reset_delivery_verification', {
      p_actor_id: input.actorId,
      p_delivery_task_id: input.resourceId,
      p_verification_kind: input.verificationKind,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }
}
