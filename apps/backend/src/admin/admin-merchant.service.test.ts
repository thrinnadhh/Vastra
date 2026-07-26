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
  public listQuery: unknown = null;

  public list(query: unknown) {
    this.listQuery = query;
    return Promise.resolve({ items: [], nextCursor: null });
  }
  public get() {
    return Promise.resolve({ merchant: { id: MERCHANT_ID } });
  }
  public setStatus(input: AdminMerchantMutationInput) {
    this.input = input;
    return Promise.resolve({ merchant: { id: MERCHANT_ID } });
  }
}

describe('AdminMerchantService', () => {
  it('builds a privacy-minimal paginated merchant query', async () => {
    const gateway = new GatewayStub();
    const service = new AdminMerchantService(gateway);
    const response = await service.list(
      CONTEXT,
      'Vastra',
      'ACTIVE',
      'APPROVED',
      'VERIFIED',
      null,
      '25',
    );
    expect(gateway.listQuery).toStrictEqual({
      query: 'Vastra',
      profileStatus: 'ACTIVE',
      onboardingStatus: 'APPROVED',
      kycStatus: 'VERIFIED',
      cursor: null,
      limit: 25,
    });
    expect(response).toStrictEqual({
      success: true,
      data: { merchants: [], nextCursor: null },
      meta: { requestId: null },
    });
  });

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
