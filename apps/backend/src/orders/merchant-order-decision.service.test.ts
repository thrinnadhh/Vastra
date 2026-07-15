import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantOrderDecisionGateway } from './merchant-order-decision.gateway';
import { MerchantOrderDecisionService } from './merchant-order-decision.service';

const CONTEXT = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
  },
} as AuthenticatedRequestContext;

const ORDER_ID = '20000000-0000-4000-8000-000000000001';

class StubGateway implements MerchantOrderDecisionGateway {
  public accept(actorId: string, orderId: string, input: { preparationMinutes: number }) {
    void actorId;

    return Promise.resolve({
      orderId,
      orderNumber: 'VAS-1',
      status: 'MERCHANT_ACCEPTED' as const,
      alertStatus: 'ACKNOWLEDGED' as const,
      merchantPreparationMinutes: input.preparationMinutes,
      acceptedAt: '2026-07-15T00:00:00Z',
      cancelledAt: null,
      cancellationReasonCode: null,
      cancellationNote: null,
      reservationsReleased: 0,
      replayed: false,
    });
  }

  public reject(
    actorId: string,
    orderId: string,
    input: {
      reasonCode: string;
      orderItemId: string | null;
      note: string | null;
    },
  ) {
    void actorId;
    void input.orderItemId;

    return Promise.resolve({
      orderId,
      orderNumber: 'VAS-1',
      status: 'CANCELLED' as const,
      alertStatus: 'ACKNOWLEDGED' as const,
      merchantPreparationMinutes: null,
      acceptedAt: null,
      cancelledAt: '2026-07-15T00:00:00Z',
      cancellationReasonCode: input.reasonCode,
      cancellationNote: input.note,
      reservationsReleased: 1,
      replayed: false,
    });
  }
}

describe('merchant order decision service', () => {
  it('accepts', async () => {
    const response = await new MerchantOrderDecisionService(new StubGateway()).accept(
      CONTEXT,
      ORDER_ID,
      { preparationMinutes: 20 },
    );

    expect(response.data.order.status).toBe('MERCHANT_ACCEPTED');
  });

  it('rejects', async () => {
    const response = await new MerchantOrderDecisionService(new StubGateway()).reject(
      CONTEXT,
      ORDER_ID,
      { reasonCode: 'OUT_OF_STOCK' },
    );

    expect(response.data.order.status).toBe('CANCELLED');
  });
});
