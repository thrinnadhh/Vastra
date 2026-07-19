import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { PaymentProviderGateway, ProviderRefundSnapshot } from './payment-provider.contract';
import type { RefundExecutionGateway } from './refund-execution.gateway';
import { RefundExecutionService } from './refund-execution.service';
import type { RefundExecutionCommandInput, RefundExecutionRecord } from './refund-execution.types';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;
const RETURN_ID = '20000000-0000-4000-8000-000000000001';
const REFUND_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';

const REFUND: RefundExecutionRecord = {
  refundId: REFUND_ID,
  refundNumber: 'REF-1',
  returnId: RETURN_ID,
  orderId: '50000000-0000-4000-8000-000000000001',
  paymentId: '60000000-0000-4000-8000-000000000001',
  providerOrderId: 'order-1',
  providerPaymentId: 'payment-1',
  providerRefundId: null,
  amountPaise: 12500,
  idempotencyKey: KEY,
  status: 'INITIATED',
  failureMessage: null,
  initiatedAt: new Date(0).toISOString(),
  completedAt: null,
  replayed: false,
};

class GatewayStub implements RefundExecutionGateway {
  public appliedStatus: string | null = null;

  public list(status: string | null, limit: number) {
    void status;
    void limit;
    return Promise.resolve([]);
  }

  public get(refundId: string) {
    return Promise.resolve(refundId === REFUND_ID ? REFUND : null);
  }

  public prepare(actorId: string, returnId: string, input: RefundExecutionCommandInput) {
    void actorId;
    void returnId;
    void input;
    return Promise.resolve(REFUND);
  }

  public markRetrying(actorId: string, refundId: string) {
    void actorId;
    void refundId;
    return Promise.resolve(REFUND);
  }

  public applyProviderResult(
    actorId: string,
    refundId: string,
    providerRefundId: string,
    providerStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
    processedAt: string | null,
    failureMessage: string | null,
  ) {
    void actorId;
    void providerRefundId;
    void processedAt;
    void failureMessage;
    this.appliedStatus = providerStatus;
    return Promise.resolve({
      ...REFUND,
      refundId,
      providerRefundId: 'cf-refund-1',
      status: providerStatus === 'SUCCESS' ? 'COMPLETED' : 'PROCESSING',
    } as RefundExecutionRecord);
  }
}

class ProviderStub implements PaymentProviderGateway {
  public createOrder(): never {
    throw new Error('not used');
  }
  public fetchOrder(): never {
    throw new Error('not used');
  }
  public verifyWebhook(): never {
    throw new Error('not used');
  }
  public createRefund(): Promise<ProviderRefundSnapshot> {
    return Promise.resolve({
      provider: 'cashfree',
      providerRefundId: 'cf-refund-1',
      internalRefundId: REFUND_ID,
      status: 'SUCCESS',
      amountPaise: 12500,
      processedAt: new Date(1).toISOString(),
    });
  }
  public fetchRefund(): Promise<ProviderRefundSnapshot> {
    return this.createRefund();
  }
}

describe('RefundExecutionService', () => {
  it('prepares and executes an approved return refund', async () => {
    const gateway = new GatewayStub();
    const service = new RefundExecutionService(gateway, new ProviderStub());
    const result = await service.create(CONTEXT, RETURN_ID, KEY, {
      reasonCode: 'REFUND_EXECUTION',
    });
    expect(result.data.status).toBe('COMPLETED');
    expect(gateway.appliedStatus).toBe('SUCCESS');
  });
});
