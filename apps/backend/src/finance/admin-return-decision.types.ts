export const ADMIN_RETURN_DECISIONS = ['APPROVE', 'REJECT', 'VERIFY'] as const;

export interface AdminReturnDecisionItem {
  readonly returnItemId: string;
  readonly approvedQuantity: number;
  readonly reasonCode: string | null;
}

export interface AdminReturnDecisionInput {
  readonly idempotencyKey: string;
  readonly decision: (typeof ADMIN_RETURN_DECISIONS)[number];
  readonly reasonCode: string;
  readonly note: string | null;
  readonly items: readonly AdminReturnDecisionItem[];
}

export type AdminReturnRecord = Readonly<Record<string, unknown>>;

export interface AdminReturnResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}
