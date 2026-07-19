import { afterEach, describe, expect, it, vi } from 'vitest';

import { CashfreeFinanceProviderGateway } from './cashfree-finance-provider.gateway';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['PAYMENT_CLIENT_ID'];
  delete process.env['PAYMENT_SECRET_KEY'];
});

describe('CashfreeFinanceProviderGateway', () => {
  it('creates and validates a Cashfree refund snapshot', async () => {
    process.env['PAYMENT_CLIENT_ID'] = 'client';
    process.env['PAYMENT_SECRET_KEY'] = 'secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            cf_refund_id: 123,
            refund_id: '30000000-0000-4000-8000-000000000001',
            order_id: 'order-1',
            refund_amount: 125,
            refund_currency: 'INR',
            refund_status: 'SUCCESS',
            processed_at: '2026-07-18T12:00:00.000Z',
          }),
      }),
    );

    const gateway = new CashfreeFinanceProviderGateway();
    const result = await gateway.createRefund({
      internalRefundId: '30000000-0000-4000-8000-000000000001',
      providerOrderId: 'order-1',
      providerPaymentId: 'payment-1',
      amountPaise: 12500,
      idempotencyKey: '40000000-0000-4000-8000-000000000001',
      note: 'Approved return',
    });

    expect(result).toMatchObject({
      providerRefundId: '123',
      status: 'SUCCESS',
      amountPaise: 12500,
    });
  });
});
