import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantSettlementGateway } from './merchant-settlement.gateway';
import { MerchantSettlementService } from './merchant-settlement.service';
import type {
  CreateMerchantSettlementInput,
  MerchantSettlementDetail,
  MerchantSettlementEligibility,
  MerchantSettlementPeriod,
} from './merchant-settlement.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const SETTLEMENT_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements MerchantSettlementGateway {
  public input: CreateMerchantSettlementInput | null = null;
  public getEligibility(period: MerchantSettlementPeriod) {
    void period;
    return Promise.resolve({ eligibleOrderCount: 2 } as MerchantSettlementEligibility);
  }
  public create(actorId: string, input: CreateMerchantSettlementInput) {
    void actorId;
    this.input = input;
    return Promise.resolve({ settlementId: SETTLEMENT_ID } as MerchantSettlementDetail);
  }
  public get(settlementId: string) {
    void settlementId;
    return Promise.resolve({ settlementId: SETTLEMENT_ID } as MerchantSettlementDetail);
  }
}

describe('MerchantSettlementService', () => {
  it('freezes a validated settlement period without accepting commission input', async () => {
    const gateway = new GatewayStub();
    const service = new MerchantSettlementService(gateway);
    const result = await service.create(CONTEXT, KEY, {
      shopId: SHOP_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-15',
      reasonCode: 'REGULAR_CYCLE',
      note: 'First settlement cycle',
    });
    expect(result.data).toEqual({ settlementId: SETTLEMENT_ID });
    expect(gateway.input).toMatchObject({
      shopId: SHOP_ID,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-15',
      idempotencyKey: KEY,
    });
    expect(gateway.input).not.toHaveProperty('commissionBps');
  });
});
