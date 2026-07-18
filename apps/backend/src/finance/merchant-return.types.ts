export const MERCHANT_INSPECTION_STATUSES = [
  'SELLABLE',
  'DAMAGED',
  'USED',
  'WRONG_ITEM',
  'DISPUTED',
] as const;
export const MERCHANT_RETURN_DECISIONS = ['ACCEPTED', 'DISPUTED', 'PARTIAL'] as const;

export interface MerchantReturnInspectionItem {
  readonly returnItemId: string;
  readonly inspectionStatus: (typeof MERCHANT_INSPECTION_STATUSES)[number];
  readonly merchantDecision: (typeof MERCHANT_RETURN_DECISIONS)[number];
  readonly note: string | null;
  readonly evidenceObjectKey: string | null;
}

export interface MerchantReturnCommandInput {
  readonly idempotencyKey: string;
  readonly note: string | null;
}

export interface MerchantReturnInspectionInput {
  readonly idempotencyKey: string;
  readonly items: readonly MerchantReturnInspectionItem[];
}

export type MerchantReturnRecord = Readonly<Record<string, unknown>>;

export interface MerchantReturnResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}
