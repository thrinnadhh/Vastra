import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { AdminMutationReasonCode } from './admin.types';

export type AdminMerchantSnapshot = Readonly<Record<string, unknown>>;
export type AdminMerchantTargetStatus = 'PAUSED' | 'SUSPENDED' | 'ACTIVE';

export interface AdminMerchantMutationInput {
  readonly actorId: string;
  readonly merchantId: string;
  readonly targetStatus: AdminMerchantTargetStatus;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminMerchantGateway {
  get(merchantId: string): Promise<AdminMerchantSnapshot | null>;
  setStatus(input: AdminMerchantMutationInput): Promise<AdminMerchantSnapshot>;
}

export class AdminMerchantGatewayUnavailableError extends Error {}
export class AdminMerchantIdempotencyConflictError extends Error {}
export class AdminMerchantStateConflictError extends Error {}

function parseSnapshot(value: unknown): AdminMerchantSnapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminMerchantGatewayUnavailableError();
  }
  return value as AdminMerchantSnapshot;
}

@Injectable()
export class SupabaseAdminMerchantGateway implements AdminMerchantGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async get(merchantId: string): Promise<AdminMerchantSnapshot | null> {
    const { data, error } = await this.client.rpc('get_admin_merchant_operations', {
      p_merchant_id: merchantId,
    });
    if (error !== null) throw new AdminMerchantGatewayUnavailableError();
    return parseSnapshot(data);
  }

  public async setStatus(input: AdminMerchantMutationInput): Promise<AdminMerchantSnapshot> {
    const { data, error } = await this.client.rpc('admin_set_merchant_operational_status', {
      p_actor_id: input.actorId,
      p_merchant_id: input.merchantId,
      p_target_status: input.targetStatus,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminMerchantIdempotencyConflictError();
      }
      if (error.message.includes('ADMIN_MERCHANT_STATE_CONFLICT')) {
        throw new AdminMerchantStateConflictError();
      }
      throw new AdminMerchantGatewayUnavailableError();
    }
    const snapshot = parseSnapshot(data);
    if (snapshot === null) throw new AdminMerchantGatewayUnavailableError();
    return snapshot;
  }
}
