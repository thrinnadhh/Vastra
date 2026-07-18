import { Injectable } from '@nestjs/common';

import { CASHFREE_API_VERSION, FINANCE_PROVIDER, formatPaiseForProvider } from './finance.contracts';
import type {
  CreateProviderOrderInput,
  CreateProviderRefundInput,
  PaymentProviderGateway,
  ProviderCheckoutSession,
  ProviderOrderSnapshot,
  ProviderRefundSnapshot,
  VerifiedProviderPaymentEvent,
  VerifyProviderWebhookInput,
} from './payment-provider.contract';

export class PaymentProviderUnavailableError extends Error {}
export class PaymentProviderResponseInvalidError extends Error {}
export class PaymentProviderOperationNotImplementedError extends Error {}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new PaymentProviderUnavailableError();
  }
  return value.trim();
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentProviderResponseInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  return value.trim();
}

function parseProviderReference(record: Record<string, unknown>): string {
  const value = record['cf_order_id'];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  throw new PaymentProviderResponseInvalidError();
}

function parseAmountPaise(record: Record<string, unknown>): number {
  const value = record['order_amount'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  const paise = Math.round(value * 100);
  if (!Number.isSafeInteger(paise) || paise < 1) throw new PaymentProviderResponseInvalidError();
  return paise;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  return value.trim();
}

function cashfreeRoot(): string {
  return process.env['NODE_ENV'] === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';
}

@Injectable()
export class CashfreePaymentProviderGateway implements PaymentProviderGateway {
  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': requireEnvironment('PAYMENT_CLIENT_ID'),
      'x-client-secret': requireEnvironment('PAYMENT_SECRET_KEY'),
      ...(idempotencyKey === undefined ? {} : { 'x-idempotency-key': idempotencyKey }),
    };
  }

  public async createOrder(input: CreateProviderOrderInput): Promise<ProviderCheckoutSession> {
    const orderMeta: Record<string, string> = {};
    if (input.returnUrl.trim().length > 0) orderMeta['return_url'] = input.returnUrl.trim();
    if (input.notifyUrl.trim().length > 0) orderMeta['notify_url'] = input.notifyUrl.trim();
    const response = await fetch(`${cashfreeRoot()}/pg/orders`, {
      method: 'POST',
      headers: this.headers(input.idempotencyKey),
      body: JSON.stringify({
        order_id: input.internalOrderId,
        order_amount: Number(formatPaiseForProvider(input.amountPaise)),
        order_currency: input.currency,
        customer_details: {
          customer_id: input.customerId,
          customer_phone: input.customerPhone,
        },
        ...(Object.keys(orderMeta).length === 0 ? {} : { order_meta: orderMeta }),
      }),
    });
    if (!response.ok) throw new PaymentProviderUnavailableError();
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentProviderResponseInvalidError();
    }
    const record = requireRecord(payload);
    const providerOrderId = requireString(record, 'order_id');
    const currency = requireString(record, 'order_currency');
    const amountPaise = parseAmountPaise(record);
    if (
      providerOrderId !== input.internalOrderId ||
      currency !== input.currency ||
      amountPaise !== input.amountPaise
    ) {
      throw new PaymentProviderResponseInvalidError();
    }
    return {
      provider: FINANCE_PROVIDER,
      providerOrderId,
      providerReferenceId: parseProviderReference(record),
      paymentSessionId: requireString(record, 'payment_session_id'),
      amountPaise,
      currency: input.currency,
      expiresAt: optionalString(record, 'order_expiry_time'),
    };
  }

  public async fetchOrder(providerOrderId: string): Promise<ProviderOrderSnapshot> {
    const response = await fetch(`${cashfreeRoot()}/pg/orders/${encodeURIComponent(providerOrderId)}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) throw new PaymentProviderUnavailableError();
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentProviderResponseInvalidError();
    }
    const record = requireRecord(payload);
    const status = requireString(record, 'order_status');
    if (!['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'].includes(status)) {
      throw new PaymentProviderResponseInvalidError();
    }
    const currency = requireString(record, 'order_currency');
    if (currency !== 'INR') throw new PaymentProviderResponseInvalidError();
    return {
      provider: FINANCE_PROVIDER,
      providerOrderId: requireString(record, 'order_id'),
      providerReferenceId: parseProviderReference(record),
      status: status as ProviderOrderSnapshot['status'],
      amountPaise: parseAmountPaise(record),
      currency,
    };
  }

  public verifyWebhook(input: VerifyProviderWebhookInput): VerifiedProviderPaymentEvent {
    void input;
    throw new PaymentProviderOperationNotImplementedError();
  }

  public createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundSnapshot> {
    void input;
    return Promise.reject(new PaymentProviderOperationNotImplementedError());
  }

  public fetchRefund(
    providerOrderId: string,
    providerRefundId: string,
  ): Promise<ProviderRefundSnapshot> {
    void providerOrderId;
    void providerRefundId;
    return Promise.reject(new PaymentProviderOperationNotImplementedError());
  }
}
