import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { AdminReturnDecisionInput, AdminReturnRecord } from './admin-return-decision.types';

export interface AdminReturnDecisionGateway {
  list(status: string | null, limit: number): Promise<readonly AdminReturnRecord[]>;
  get(returnId: string): Promise<AdminReturnRecord | null>;
  decide(
    actorId: string,
    returnId: string,
    input: AdminReturnDecisionInput,
  ): Promise<AdminReturnRecord>;
}

export class AdminReturnDecisionGatewayUnavailableError extends Error {}
export class AdminReturnDecisionNotFoundError extends Error {}
export class AdminReturnDecisionStateConflictError extends Error {}
export class AdminReturnDecisionIdempotencyConflictError extends Error {}

function requireRecord(value: unknown): AdminReturnRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminReturnDecisionGatewayUnavailableError();
  }
  return value as AdminReturnRecord;
}

@Injectable()
export class SupabaseAdminReturnDecisionGateway implements AdminReturnDecisionGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new AdminReturnDecisionIdempotencyConflictError();
    }
    if (
      message.includes('FINANCE_RETURN_STATE_CONFLICT') ||
      message.includes('FINANCE_RETURN_DECISION_CONFLICT')
    ) {
      throw new AdminReturnDecisionStateConflictError();
    }
    if (message.includes('FINANCE_RETURN_NOT_FOUND')) {
      throw new AdminReturnDecisionNotFoundError();
    }
    throw new AdminReturnDecisionGatewayUnavailableError();
  }

  public async list(status: string | null, limit: number): Promise<readonly AdminReturnRecord[]> {
    const { data, error } = await this.client.rpc('list_admin_returns', {
      p_status: status,
      p_limit: limit,
    });
    if (error !== null) this.mapError(error.message);
    if (!Array.isArray(data)) {
      throw new AdminReturnDecisionGatewayUnavailableError();
    }
    return data.map(requireRecord);
  }

  public async get(returnId: string): Promise<AdminReturnRecord | null> {
    const { data, error } = await this.client.rpc('get_admin_return', {
      p_return_id: returnId,
    });
    if (error !== null) this.mapError(error.message);
    return data === null ? null : requireRecord(data);
  }

  public async decide(
    actorId: string,
    returnId: string,
    input: AdminReturnDecisionInput,
  ): Promise<AdminReturnRecord> {
    const { data, error } = await this.client.rpc('decide_admin_return', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_decision: input.decision,
      p_items: input.items,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }
}
