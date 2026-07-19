import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminReturnDecisionGateway } from './admin-return-decision.gateway';
import { AdminReturnDecisionService } from './admin-return-decision.service';
import type { AdminReturnDecisionInput } from './admin-return-decision.types';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;
const RETURN_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';

class GatewayStub implements AdminReturnDecisionGateway {
  public input: AdminReturnDecisionInput | null = null;

  public list(status: string | null, limit: number) {
    void status;
    void limit;
    return Promise.resolve([]);
  }

  public get(returnId: string) {
    return Promise.resolve({ returnId });
  }

  public decide(actorId: string, returnId: string, input: AdminReturnDecisionInput) {
    void actorId;
    this.input = input;
    return Promise.resolve({ returnId, status: 'VERIFIED' });
  }
}

describe('AdminReturnDecisionService', () => {
  it('validates and submits a line-level inspection resolution', async () => {
    const gateway = new GatewayStub();
    const service = new AdminReturnDecisionService(gateway);
    const result = await service.decide(CONTEXT, RETURN_ID, KEY, {
      decision: 'VERIFY',
      reasonCode: 'REFUND_DECISION',
      items: [{ returnItemId: ITEM_ID, approvedQuantity: 1 }],
    });
    expect(result.data).toEqual({ returnId: RETURN_ID, status: 'VERIFIED' });
    expect(gateway.input?.items).toEqual([
      { returnItemId: ITEM_ID, approvedQuantity: 1, reasonCode: null },
    ]);
  });
});
