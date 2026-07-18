export interface MerchantSettlementPeriod {
  readonly shopId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export interface CreateMerchantSettlementInput extends MerchantSettlementPeriod {
  readonly reasonCode: string;
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export type MerchantSettlementEligibility = Readonly<Record<string, unknown>>;
export type MerchantSettlementDetail = Readonly<Record<string, unknown>>;

export interface MerchantSettlementResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: string | null };
}
