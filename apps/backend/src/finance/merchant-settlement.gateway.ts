import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateMerchantSettlementInput,
  MerchantSettlementDetail,
  MerchantSettlementEligibility,
  MerchantSettlementPeriod,
} from './merchant-settlement.types';

export interface MerchantSettlementGateway {
  getEligibility(period: MerchantSettlementPeriod): Promise<MerchantSettlementEligibility>;
  create(actorId: string, input: CreateMerchantSettlementInput): Promise<MerchantSettlementDetail>;
  get(settlementId: string): Promise<MerchantSettlementDetail | null>;
}

export class MerchantSettlementGatewayUnavailableError extends Error {}
export class MerchantSettlementNotEligibleError extends Error {}
export class MerchantSettlementIdempotencyConflictError extends Error {}
export class MerchantSettlementAlreadyExistsError extends Error {}

function parseRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new MerchantSettlementGatewayUnavailableError();
  }
  return value as Readonly<Record<string, unknown>>;
}

@Injectable()
export class SupabaseMerchantSettlementGateway implements MerchantSettlementGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_SETTLEMENT_NOT_ELIGIBLE')) {
      throw new MerchantSettlementNotEligibleError();
    }
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new MerchantSettlementIdempotencyConflictError();
    }
    if (message.includes('FINANCE_SETTLEMENT_EXISTS')) {
      throw new MerchantSettlementAlreadyExistsError();
    }
    throw new MerchantSettlementGatewayUnavailableError();
  }

  public async getEligibility(
    period: MerchantSettlementPeriod,
  ): Promise<MerchantSettlementEligibility> {
    const { data, error } = await this.client.rpc('get_merchant_settlement_eligibility', {
      p_shop_id: period.shopId,
      p_period_start: period.periodStart,
      p_period_end: period.periodEnd,
    });
    if (error !== null) this.mapError(error.message);
    const result = parseRecord(data);
    if (result === null) throw new MerchantSettlementGatewayUnavailableError();
    return result;
  }

  public async create(
    actorId: string,
    input: CreateMerchantSettlementInput,
  ): Promise<MerchantSettlementDetail> {
    const { data, error } = await this.client.rpc('create_merchant_settlement_ledger', {
      p_actor_id: actorId,
      p_shop_id: input.shopId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    const result = parseRecord(data);
    if (result === null) throw new MerchantSettlementGatewayUnavailableError();
    return result;
  }

  public async get(settlementId: string): Promise<MerchantSettlementDetail | null> {
    const { data, error } = await this.client.rpc('get_merchant_settlement_detail', {
      p_settlement_id: settlementId,
    });
    if (error !== null) this.mapError(error.message);
    return parseRecord(data);
  }
}
