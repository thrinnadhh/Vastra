export interface PaymentProcessingSummary {
  readonly selected: number;
  readonly processed: number;
  readonly ignored: number;
  readonly failed: number;
}

export interface PaymentEventRetryResult {
  readonly eventId: string;
  readonly paymentId: string;
  readonly processingStatus: 'RECEIVED';
  readonly replayed: boolean;
}

export interface PaymentProcessingResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: null };
}
