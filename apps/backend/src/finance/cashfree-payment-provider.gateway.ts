import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  CASHFREE_API_VERSION,
  FINANCE_PROVIDER,
  formatPaiseForProvider,
} from './finance.contracts';
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
export class PaymentWebhookSignatureInvalidError extends Error {}
export class PaymentWebhookPayloadInvalidError extends Error {}

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

function requireWebhookRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentWebhookPayloadInvalidError();
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

function requireWebhookString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentWebhookPayloadInvalidError();
  }
  return value.trim();
}

function parseProviderReference(record: Record<string, unknown>): string {
  const value = record['cf_order_id'];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  throw new PaymentProviderResponseInvalidError();
}

function parseAmount(value: unknown, error: Error): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw error;
  const scaled = value * 100;
  const paise = Math.round(scaled);
  if (!Number.isSafeInteger(paise) || paise < 1 || Math.abs(scaled - paise) > 0.000_001) {
    throw error;
  }
  return paise;
}

function parseAmountPaise(record: Record<string, unknown>): number {
  return parseAmount(record['order_amount'], new PaymentProviderResponseInvalidError());
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

function verifyCashfreeSignature(input: VerifyProviderWebhookInput): void {
  if (input.version !== CASHFREE_API_VERSION) throw new PaymentWebhookPayloadInvalidError();
  if (!/^\d{10,16}$/u.test(input.timestamp)) throw new PaymentWebhookPayloadInvalidError();
  if (input.idempotencyKey.length < 16 || input.idempotencyKey.length > 256) {
    throw new PaymentWebhookPayloadInvalidError();
  }
  const expected = createHmac('sha256', requireEnvironment('PAYMENT_SECRET_KEY'))
    .update(input.timestamp)
    .update(input.rawBody)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(input.signature, 'base64');
  } catch {
    throw new PaymentWebhookSignatureInvalidError();
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new PaymentWebhookSignatureInvalidError();
  }
}

function parseWebhookPaymentId(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  throw new PaymentWebhookPayloadInvalidError();
}

function parseWebhookEvent(input: VerifyProviderWebhookInput): VerifiedProviderPaymentEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody) as unknown;
  } catch {
    throw new PaymentWebhookPayloadInvalidError();
  }
  const root = requireWebhookRecord(payload);
  const type = requireWebhookString(root, 'type');
  const eventTime = requireWebhookString(root, 'event_time');
  if (Number.isNaN(Date.parse(eventTime))) throw new PaymentWebhookPayloadInvalidError();
  const data = requireWebhookRecord(root['data']);
  const order = requireWebhookRecord(data['order']);
  const payment = requireWebhookRecord(data['payment']);
  const providerOrderId = requireWebhookString(order, 'order_id');
  const providerPaymentId = parseWebhookPaymentId(payment['cf_payment_id']);
  const orderCurrency = requireWebhookString(order, 'order_currency');
  const paymentCurrency = requireWebhookString(payment, 'payment_currency');
  if (orderCurrency !== 'INR' || paymentCurrency !== 'INR') {
    throw new PaymentWebhookPayloadInvalidError();
  }
  const orderAmount = parseAmount(order['order_amount'], new PaymentWebhookPayloadInvalidError());
  const paymentAmount = parseAmount(
    payment['payment_amount'],
    new PaymentWebhookPayloadInvalidError(),
  );
  if (orderAmount !== paymentAmount) throw new PaymentWebhookPayloadInvalidError();
  const paymentStatus = requireWebhookString(payment, 'payment_status');
  const mappings: Readonly<
    Record<
      string,
      {
        readonly status: string;
        readonly eventType: VerifiedProviderPaymentEvent['eventType'];
      }
    >
  > = {
    PAYMENT_SUCCESS_WEBHOOK: { status: 'SUCCESS', eventType: 'PAYMENT_SUCCESS' },
    PAYMENT_FAILED_WEBHOOK: { status: 'FAILED', eventType: 'PAYMENT_FAILED' },
    PAYMENT_USER_DROPPED_WEBHOOK: {
      status: 'USER_DROPPED',
      eventType: 'PAYMENT_USER_DROPPED',
    },
  };
  const mapping = mappings[type];
  if (mapping?.status !== paymentStatus) {
    throw new PaymentWebhookPayloadInvalidError();
  }
  return {
    provider: FINANCE_PROVIDER,
    providerEventId: input.idempotencyKey,
    eventType: mapping.eventType,
    providerOrderId,
    providerPaymentId,
    amountPaise: paymentAmount,
    currency: 'INR',
    occurredAt: eventTime,
    payload: root,
  };
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
    const response = await fetch(
      `${cashfreeRoot()}/pg/orders/${encodeURIComponent(providerOrderId)}`,
      {
        method: 'GET',
        headers: this.headers(),
      },
    );
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
    verifyCashfreeSignature(input);
    return parseWebhookEvent(input);
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
