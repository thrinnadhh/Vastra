import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CaptainFinanceRecord,
  CreateCaptainPayoutInput,
  ReconcileCodInput,
} from './captain-finance.types';

export interface CaptainFinanceGateway {
  listCod(status: string | null, limit: number): Promise<readonly CaptainFinanceRecord[]>;
  reconcileCod(
    actorId: string,
    collectionId: string,
    input: ReconcileCodInput,
  ): Promise<CaptainFinanceRecord>;
  getPayoutEligibility(
    captainId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CaptainFinanceRecord>;
  createPayout(actorId: string, input: CreateCaptainPayoutInput): Promise<CaptainFinanceRecord>;
  getPayout(payoutId: string): Promise<CaptainFinanceRecord | null>;
}

export class CaptainFinanceGatewayUnavailableError extends Error {}
export class CaptainFinanceNotFoundError extends Error {}
export class CaptainFinanceStateConflictError extends Error {}
export class CaptainFinanceIdempotencyConflictError extends Error {}
export class CaptainFinanceNotEligibleError extends Error {}

function requireRecord(value: unknown): CaptainFinanceRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaptainFinanceGatewayUnavailableError();
  }
  return value as CaptainFinanceRecord;
}

@Injectable()
export class SupabaseCaptainFinanceGateway implements CaptainFinanceGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT'))
      throw new CaptainFinanceIdempotencyConflictError();
    if (message.includes('FINANCE_COD_NOT_RECONCILED')) throw new CaptainFinanceNotEligibleError();
    if (message.includes('FINANCE_PAYOUT_NOT_ELIGIBLE')) throw new CaptainFinanceNotEligibleError();
    if (message.includes('FINANCE_PAYMENT_STATE_CONFLICT'))
      throw new CaptainFinanceStateConflictError();
    if (message.includes('FINANCE_PAYMENT_NOT_FOUND')) throw new CaptainFinanceNotFoundError();
    throw new CaptainFinanceGatewayUnavailableError();
  }

  public async listCod(
    status: string | null,
    limit: number,
  ): Promise<readonly CaptainFinanceRecord[]> {
    const { data, error } = await this.client.rpc('admin_list_cod_collections', {
      p_status: status,
      p_limit: limit,
    });
    if (error !== null) this.mapError(error.message);
    if (!Array.isArray(data)) throw new CaptainFinanceGatewayUnavailableError();
    return data.map(requireRecord);
  }

  public async reconcileCod(
    actorId: string,
    collectionId: string,
    input: ReconcileCodInput,
  ): Promise<CaptainFinanceRecord> {
    const { data, error } = await this.client.rpc('admin_reconcile_cod_collection', {
      p_actor_id: actorId,
      p_collection_id: collectionId,
      p_deposited_amount_paise: input.depositedAmountPaise,
      p_idempotency_key: input.idempotencyKey,
      p_note: input.note,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async getPayoutEligibility(
    captainId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CaptainFinanceRecord> {
    const { data, error } = await this.client.rpc('get_captain_payout_eligibility', {
      p_captain_id: captainId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async createPayout(
    actorId: string,
    input: CreateCaptainPayoutInput,
  ): Promise<CaptainFinanceRecord> {
    const { data, error } = await this.client.rpc('admin_create_captain_payout', {
      p_actor_id: actorId,
      p_captain_id: input.captainId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_idempotency_key: input.idempotencyKey,
      p_note: input.note,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }

  public async getPayout(payoutId: string): Promise<CaptainFinanceRecord | null> {
    const { data, error } = await this.client.rpc('get_captain_payout', { p_payout_id: payoutId });
    if (error !== null) this.mapError(error.message);
    return data === null ? null : requireRecord(data);
  }
}
