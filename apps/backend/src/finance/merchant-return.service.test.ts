import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantReturnGateway } from './merchant-return.gateway';
import { MerchantReturnService } from './merchant-return.service';
import type { MerchantReturnCommandInput, MerchantReturnInspectionInput } from './merchant-return.types';

const CONTEXT = { actor: { id: '10000000-0000-4000-8000-000000000001' } } as AuthenticatedRequestContext;
const RETURN_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';

class GatewayStub implements MerchantReturnGateway {
  public inspection: MerchantReturnInspectionInput | null = null;
  public list(actorId: string, limit: number) { void actorId; void limit; return Promise.resolve([]); }
  public get(actorId: string, returnId: string) { void actorId; return Promise.resolve({ returnId }); }
  public receive(actorId: string, returnId: string, input: MerchantReturnCommandInput) { void actorId; void input; return Promise.resolve({ returnId, status: 'RECEIVED' }); }
  public inspect(actorId: string, returnId: string, input: MerchantReturnInspectionInput) { void actorId; this.inspection = input; return Promise.resolve({ returnId, status: 'VERIFIED' }); }
}

describe('MerchantReturnService', () => {
  it('submits a complete typed inspection', async () => {
    const gateway = new GatewayStub();
    const service = new MerchantReturnService(gateway);
    const result = await service.inspect(CONTEXT, RETURN_ID, KEY, {
      items: [{ returnItemId: ITEM_ID, inspectionStatus: 'SELLABLE', merchantDecision: 'ACCEPTED' }],
    });
    expect(result.data).toEqual({ returnId: RETURN_ID, status: 'VERIFIED' });
    expect(gateway.inspection?.items).toHaveLength(1);
  });
});
