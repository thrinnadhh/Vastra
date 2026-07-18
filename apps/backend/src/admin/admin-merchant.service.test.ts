import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminMerchantGateway, AdminMerchantMutationInput } from './admin-merchant.gateway';
import { AdminMerchantRequestInvalidError, AdminMerchantService } from './admin-merchant.service';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;
const MERCHANT_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';

class GatewayStub implements AdminMerchantGateway {
  public input: AdminMerchantMutationInput | null = null;
  public get() {
    return Promise.resolve({ merchant: { id: MERCHANT_ID } });
  }
  public setStatus(input: AdminMerchantMutationInput) {
    this.input = input;
    return Promise.resolve({ merchant: { id: MERCHANT_ID } });
  }
}

describe('AdminMerchantService', () => {
  it('builds an actor-bound, idempotent suspension command', async () => {
    const gateway = new GatewayStub();
    const service = new AdminMerchantService(gateway);
    await service.setStatus(
      CONTEXT,
      MERCHANT_ID,
      KEY,
      { reasonCode: 'POLICY_VIOLATION', note: 'Repeated catalogue mismatch' },
      'SUSPENDED',
      'request-1',
    );
    expect(gateway.input).toEqual(
      expect.objectContaining({
        actorId: CONTEXT.actor.id,
        merchantId: MERCHANT_ID,
        idempotencyKey: KEY,
        targetStatus: 'SUSPENDED',
      }),
    );
  });

  it('rejects unknown reason codes', () => {
    const service = new AdminMerchantService(new GatewayStub());
    expect(() =>
      service.setStatus(CONTEXT, MERCHANT_ID, KEY, { reasonCode: 'NOPE' }, 'PAUSED', null),
    ).toThrow(AdminMerchantRequestInvalidError);
  });
});
