import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminOperationInput,
  AdminOperationResult,
  AdminOrderOperationsGateway,
  AdminResetVerificationInput,
} from './admin-order-operations.gateway';
import {
  AdminOrderOperationIdempotencyKeyRequiredError,
  AdminOrderOperationRequestInvalidError,
  AdminOrderOperationsService,
} from './admin-order-operations.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const RESOURCE_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements AdminOrderOperationsGateway {
  public last: AdminOperationInput | AdminResetVerificationInput | null = null;
  private capture(input: AdminOperationInput | AdminResetVerificationInput) {
    this.last = input;
    return Promise.resolve({ ok: true } as AdminOperationResult);
  }
  public cancelOrder(input: AdminOperationInput) {
    return this.capture(input);
  }
  public retryDispatch(input: AdminOperationInput) {
    return this.capture(input);
  }
  public releaseDelivery(input: AdminOperationInput) {
    return this.capture(input);
  }
  public resetVerification(input: AdminResetVerificationInput) {
    return this.capture(input);
  }
}

describe('AdminOrderOperationsService', () => {
  it('requires a UUID idempotency key for every mutation', async () => {
    const service = new AdminOrderOperationsService(new GatewayStub());
    await expect(
      service.cancelOrder(CONTEXT, RESOURCE_ID, undefined, null, {
        reasonCode: 'OPERATIONAL_RECOVERY',
      }),
    ).rejects.toBeInstanceOf(AdminOrderOperationIdempotencyKeyRequiredError);
  });

  it('derives the actor and parses a bounded mutation reason', async () => {
    const gateway = new GatewayStub();
    const service = new AdminOrderOperationsService(gateway);
    await service.retryDispatch(CONTEXT, RESOURCE_ID, KEY, 'request-1', {
      reasonCode: 'DELIVERY_FAILURE',
      note: 'Restart captain search',
    });
    expect(gateway.last).toMatchObject({
      actorId: ACTOR_ID,
      resourceId: RESOURCE_ID,
      idempotencyKey: KEY,
      reasonCode: 'DELIVERY_FAILURE',
      requestId: 'request-1',
    });
  });

  it('rejects unsupported verification reset kinds', async () => {
    const service = new AdminOrderOperationsService(new GatewayStub());
    await expect(
      service.resetVerification(CONTEXT, RESOURCE_ID, KEY, null, {
        reasonCode: 'OPERATIONAL_RECOVERY',
        verificationKind: 'RAW_SECRET',
      }),
    ).rejects.toBeInstanceOf(AdminOrderOperationRequestInvalidError);
  });
});
