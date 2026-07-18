import { Injectable } from '@nestjs/common';

import {
  CashfreePaymentProviderGateway,
  PaymentProviderResponseInvalidError,
  PaymentProviderUnavailableError,
} from './cashfree-payment-provider.gateway';
import {
  CASHFREE_API_VERSION,
  FINANCE_PROVIDER,
  formatPaiseForProvider,
} from './finance.contracts';
import type {
  CreateProviderRefundInput,
  ProviderRefundSnapshot,
} from './payment-provider.contract';

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new PaymentProviderUnavailableError();
  }
  return value.trim();
}

function cashfreeRoot(): string {
  return process.env['NODE_ENV'] === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';
}

function requireRecord(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new PaymentProviderResponseInvalidError();
  }
  return candidate as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  return value.trim();
}

function parseRefundAmount(record: Record<string, unknown>): number {
  const value = record['refund_amount'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PaymentProviderResponseInvalidError();
  }
  const paise = Math.round(value * 100);
  if (!Number.isSafeInteger(paise) || paise < 1 || Math.abs(value * 100 - paise) > 0.000_001) {
    throw new PaymentProviderResponseInvalidError();
  }
  return paise;
}

function parseProviderRefundId(record: Record<string, unknown>): string {
  const value = record['cf_refund_id'];
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new PaymentProviderResponseInvalidError();
}

function mapRefundStatus(value: string): ProviderRefundSnapshot['status'] {
  if (value === 'SUCCESS') return 'SUCCESS';
  if (value === 'FAILED') return 'FAILED';
  if (value === 'CANCELLED') return 'CANCELLED';
  if (value === 'PENDING' || value === 'ONHOLD') return 'PENDING';
  throw new PaymentProviderResponseInvalidError();
}

function parseSnapshot(
  payload: unknown,
  expectedInternalRefundId?: string,
  expectedAmountPaise?: number,
  expectedProviderOrderId?: string,
): ProviderRefundSnapshot {
  const record = requireRecord(payload);
  const internalRefundId = requireString(record, 'refund_id');
  const amountPaise = parseRefundAmount(record);
  const currency = requireString(record, 'refund_currency');
  const providerOrderId = requireString(record, 'order_id');
  if (
    currency !== 'INR' ||
    (expectedInternalRefundId !== undefined && internalRefundId !== expectedInternalRefundId) ||
    (expectedAmountPaise !== undefined && amountPaise !== expectedAmountPaise) ||
    (expectedProviderOrderId !== undefined && providerOrderId !== expectedProviderOrderId)
  ) {
    throw new PaymentProviderResponseInvalidError();
  }
  return {
    provider: FINANCE_PROVIDER,
    providerRefundId: parseProviderRefundId(record),
    internalRefundId,
    status: mapRefundStatus(requireString(record, 'refund_status')),
    amountPaise,
    processedAt: optionalString(record, 'processed_at'),
  };
}

@Injectable()
export class CashfreeFinanceProviderGateway extends CashfreePaymentProviderGateway {
  private refundHeaders(idempotencyKey?: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': requireEnvironment('PAYMENT_CLIENT_ID'),
      'x-client-secret': requireEnvironment('PAYMENT_SECRET_KEY'),
      ...(idempotencyKey === undefined ? {} : { 'x-idempotency-key': idempotencyKey }),
    };
  }

  public override async createRefund(
    input: CreateProviderRefundInput,
  ): Promise<ProviderRefundSnapshot> {
    const response = await fetch(
      `${cashfreeRoot()}/pg/orders/${encodeURIComponent(input.providerOrderId)}/refunds`,
      {
        method: 'POST',
        headers: this.refundHeaders(input.idempotencyKey),
        body: JSON.stringify({
          refund_amount: Number(formatPaiseForProvider(input.amountPaise)),
          refund_id: input.internalRefundId,
          refund_note: input.note,
          refund_speed: 'STANDARD',
        }),
      },
    );
    if (!response.ok) throw new PaymentProviderUnavailableError();
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentProviderResponseInvalidError();
    }
    return parseSnapshot(
      payload,
      input.internalRefundId,
      input.amountPaise,
      input.providerOrderId,
    );
  }

  public override async fetchRefund(
    providerOrderId: string,
    internalRefundId: string,
  ): Promise<ProviderRefundSnapshot> {
    const response = await fetch(
      `${cashfreeRoot()}/pg/orders/${encodeURIComponent(providerOrderId)}/refunds/${encodeURIComponent(internalRefundId)}`,
      {
        method: 'GET',
        headers: this.refundHeaders(),
      },
    );
    if (!response.ok) throw new PaymentProviderUnavailableError();
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentProviderResponseInvalidError();
    }
    return parseSnapshot(payload, internalRefundId, undefined, providerOrderId);
  }
}
