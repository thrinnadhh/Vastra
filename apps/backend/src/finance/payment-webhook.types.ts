export interface PaymentWebhookReceipt {
  readonly eventId: string;
  readonly providerEventId: string;
  readonly paymentId: string | null;
  readonly processingStatus: 'RECEIVED';
  readonly replayed: boolean;
}

export interface PaymentWebhookResponse {
  readonly success: true;
  readonly data: PaymentWebhookReceipt;
  readonly meta: { readonly requestId: null };
}
