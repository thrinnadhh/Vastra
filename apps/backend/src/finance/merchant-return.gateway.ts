import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  MerchantReturnCommandInput,
  MerchantReturnInspectionInput,
  MerchantReturnRecord,
} from './merchant-return.types';

export interface MerchantReturnGateway {
  list(actorId: string, limit: number): Promise<readonly MerchantReturnRecord[]>;
  get(actorId: string, returnId: string): Promise<MerchantReturnRecord | null>;
  receive(actorId: string, returnId: string, input: MerchantReturnCommandInput): Promise<MerchantReturnRecord>;
  inspect(actorId: string, returnId: string, input: MerchantReturnInspectionInput): Promise<MerchantReturnRecord>;
}

export class MerchantReturnGatewayUnavailableError extends Error {}
export class MerchantReturnNotFoundError extends Error {}
export class MerchantReturnStateConflictError extends Error {}
export class MerchantReturnIdempotencyConflictError extends Error {}

function requireRecord(value: unknown): MerchantReturnRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantReturnGatewayUnavailableError();
  }
  return value as MerchantReturnRecord;
}

@Injectable()
export class SupabaseMerchantReturnGateway implements MerchantReturnGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) throw new MerchantReturnIdempotencyConflictError();
    if (message.includes('FINANCE_RETURN_STATE_CONFLICT')) throw new MerchantReturnStateConflictError();
    if (message.includes('FINANCE_RETURN_NOT_FOUND')) throw new MerchantReturnNotFoundError();
    throw new MerchantReturnGatewayUnavailableError();
  }

  public async list(actorId: string, limit: number): Promise<readonly MerchantReturnRecord[]> {
    const { data, error } = await this.client.rpc('merchant_list_returns', {
      p_actor_id: actorId,
      p_limit: limit,
    });
    if (error !== null) this.mapError(error.message);
    if (!Array.isArray(data)) throw new MerchantReturnGatewayUnavailableError();
    return data.map(requireRecord);
  }

  public async get(actorId: string, returnId: string): Promise<MerchantReturnRecord | null> {
    const { data, error } = await this.client.rpc('merchant_get_return', {
      p_actor_id: actorId,
      p_return_id: returnId,
    });
    if (error !== null) this.mapError(error.message);
    return data === null ? null : requireRecord(data);
  }

  public async receive(actorId: string, returnId: string, input: MerchantReturnCommandInput): Promise<MerchantReturnRecord> {
    const { data, error } = await this.client.rpc('merchant_receive_return', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_idempotency_key: input.idempotencyKey,
      p_note: input.note,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async inspect(actorId: string, returnId: string, input: MerchantReturnInspectionInput): Promise<MerchantReturnRecord> {
    const { data, error } = await this.client.rpc('merchant_submit_return_inspection', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_items: input.items,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }
}
