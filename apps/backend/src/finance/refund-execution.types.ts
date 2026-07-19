export const REFUND_PROVIDER_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] as const;

export interface RefundExecutionCommandInput {
  readonly idempotencyKey: string;
  readonly reasonCode: string;
  readonly note: string | null;
}

export interface RefundExecutionRecord {
  readonly refundId: string;
  readonly refundNumber: string;
  readonly returnId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly providerOrderId: string;
  readonly providerPaymentId: string;
  readonly providerRefundId: string | null;
  readonly amountPaise: number;
  readonly idempotencyKey: string;
  readonly status:
    | 'PENDING'
    | 'APPROVAL_REQUIRED'
    | 'INITIATED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  readonly failureMessage: string | null;
  readonly initiatedAt: string | null;
  readonly completedAt: string | null;
  readonly replayed: boolean;
}

export interface RefundExecutionResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}
