export type CaptainFinanceRecord = Readonly<Record<string, unknown>>;

export interface ReconcileCodInput {
  readonly depositedAmountPaise: number;
  readonly reasonCode: 'COD_RECONCILIATION';
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export interface CreateCaptainPayoutInput {
  readonly captainId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly reasonCode: 'PAYOUT_CYCLE';
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export interface CaptainFinanceResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}
