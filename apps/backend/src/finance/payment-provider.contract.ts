import type { FINANCE_CURRENCY, FINANCE_PROVIDER } from './finance.contracts';

export type FinanceProvider = typeof FINANCE_PROVIDER;
export type FinanceCurrency = typeof FINANCE_CURRENCY;

export interface CreateProviderOrderInput {
  readonly internalOrderId: string;
  readonly customerId: string;
  readonly customerPhone: string;
  readonly amountPaise: number;
  readonly currency: FinanceCurrency;
  readonly idempotencyKey: string;
  readonly returnUrl: string;
  readonly notifyUrl: string;
}

export interface ProviderCheckoutSession {
  readonly provider: FinanceProvider;
  readonly providerOrderId: string;
  readonly providerReferenceId: string;
  readonly paymentSessionId: string;
  readonly amountPaise: number;
  readonly currency: FinanceCurrency;
  readonly expiresAt: string | null;
}

export interface ProviderOrderSnapshot {
  readonly provider: FinanceProvider;
  readonly providerOrderId: string;
  readonly providerReferenceId: string;
  readonly status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED';
  readonly amountPaise: number;
  readonly currency: FinanceCurrency;
}

export interface VerifyProviderWebhookInput {
  readonly rawBody: string;
  readonly signature: string;
  readonly timestamp: string;
  readonly version: string;
  readonly idempotencyKey: string;
}

export interface VerifiedProviderPaymentEvent {
  readonly provider: FinanceProvider;
  readonly providerEventId: string;
  readonly eventType: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'PAYMENT_USER_DROPPED';
  readonly providerOrderId: string;
  readonly providerPaymentId: string;
  readonly amountPaise: number;
  readonly currency: FinanceCurrency;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface CreateProviderRefundInput {
  readonly internalRefundId: string;
  readonly providerOrderId: string;
  readonly providerPaymentId: string;
  readonly amountPaise: number;
  readonly idempotencyKey: string;
  readonly note: string;
}

export interface ProviderRefundSnapshot {
  readonly provider: FinanceProvider;
  readonly providerRefundId: string;
  readonly internalRefundId: string;
  readonly status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  readonly amountPaise: number;
  readonly processedAt: string | null;
}

export interface PaymentProviderGateway {
  createOrder(input: CreateProviderOrderInput): Promise<ProviderCheckoutSession>;
  fetchOrder(providerOrderId: string): Promise<ProviderOrderSnapshot>;
  verifyWebhook(input: VerifyProviderWebhookInput): VerifiedProviderPaymentEvent;
  createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundSnapshot>;
  fetchRefund(providerOrderId: string, internalRefundId: string): Promise<ProviderRefundSnapshot>;
}
