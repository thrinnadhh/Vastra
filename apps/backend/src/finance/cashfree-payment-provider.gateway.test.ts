import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CashfreePaymentProviderGateway,
  PaymentWebhookSignatureInvalidError,
} from './cashfree-payment-provider.gateway';

const SECRET = 'local-payment-secret-placeholder';
const TIMESTAMP = '1746427759733';
const EVENT_ID = 'n9rn7079wqXcse3GEDEXCYle9ajXmU0SUQY8zrUNAlc=';

function payload(): string {
  return JSON.stringify({
    data: {
      order: {
        order_id: 'VASPAY30000000000040008000000000000001',
        order_amount: 125,
        order_currency: 'INR',
      },
      payment: {
        cf_payment_id: '1453002795',
        payment_status: 'SUCCESS',
        payment_amount: 125,
        payment_currency: 'INR',
      },
    },
    event_time: '2026-07-18T10:00:00+05:30',
    type: 'PAYMENT_SUCCESS_WEBHOOK',
  });
}

function signature(rawBody: string): string {
  return createHmac('sha256', SECRET).update(TIMESTAMP).update(rawBody).digest('base64');
}

describe('CashfreePaymentProviderGateway webhook verification', () => {
  const previousSecret = process.env['PAYMENT_SECRET_KEY'];

  beforeEach(() => {
    process.env['PAYMENT_SECRET_KEY'] = SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env['PAYMENT_SECRET_KEY'];
    else process.env['PAYMENT_SECRET_KEY'] = previousSecret;
  });

  it('verifies the exact raw body and maps a payment event', () => {
    const rawBody = payload();
    const event = new CashfreePaymentProviderGateway().verifyWebhook({
      rawBody,
      signature: signature(rawBody),
      timestamp: TIMESTAMP,
      version: '2025-01-01',
      idempotencyKey: EVENT_ID,
    });
    expect(event).toMatchObject({
      provider: 'cashfree',
      providerEventId: EVENT_ID,
      eventType: 'PAYMENT_SUCCESS',
      providerPaymentId: '1453002795',
      amountPaise: 12500,
      currency: 'INR',
    });
  });

  it('rejects a payload changed after the signature was generated', () => {
    const rawBody = payload();
    expect(() =>
      new CashfreePaymentProviderGateway().verifyWebhook({
        rawBody: `${rawBody} `,
        signature: signature(rawBody),
        timestamp: TIMESTAMP,
        version: '2025-01-01',
        idempotencyKey: EVENT_ID,
      }),
    ).toThrow(PaymentWebhookSignatureInvalidError);
  });
});
