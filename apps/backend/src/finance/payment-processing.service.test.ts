import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { PaymentProcessingGateway } from './payment-processing.gateway';
import { PaymentProcessingService } from './payment-processing.service';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;

class GatewayStub implements PaymentProcessingGateway {
  public limit = 0;
  public processBatch(limit: number) {
    this.limit = limit;
    return Promise.resolve({ selected: 2, processed: 1, ignored: 1, failed: 0 });
  }
  public retryFailedEvent(
    actorId: string,
    eventId: number,
    idempotencyKey: string,
    note: string | null,
  ) {
    void actorId;
    void idempotencyKey;
    void note;
    return Promise.resolve({
      eventId: String(eventId),
      paymentId: '20000000-0000-4000-8000-000000000001',
      processingStatus: 'RECEIVED' as const,
      replayed: false,
    });
  }
}

describe('PaymentProcessingService', () => {
  it('bounds and forwards the batch size', async () => {
    const gateway = new GatewayStub();
    const result = await new PaymentProcessingService(gateway).process('10');
    expect(gateway.limit).toBe(10);
    expect(result.data.processed).toBe(1);
  });

  it('requeues one failed event with a UUID command identity', async () => {
    const service = new PaymentProcessingService(new GatewayStub());
    const result = await service.retry(CONTEXT, '42', '30000000-0000-4000-8000-000000000001', {
      note: 'Provider outage recovered',
    });
    expect(result.data.eventId).toBe('42');
  });
});
