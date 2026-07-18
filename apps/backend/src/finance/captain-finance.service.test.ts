import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CaptainFinanceGateway } from './captain-finance.gateway';
import { CaptainFinanceService } from './captain-finance.service';
import type { CreateCaptainPayoutInput, ReconcileCodInput } from './captain-finance.types';

const CONTEXT = {
  actor: { id: '10000000-0000-4000-8000-000000000001' },
} as AuthenticatedRequestContext;
const ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';

class GatewayStub implements CaptainFinanceGateway {
  public listCod(status: string | null, limit: number) {
    void status;
    void limit;
    return Promise.resolve([]);
  }
  public reconcileCod(actorId: string, collectionId: string, input: ReconcileCodInput) {
    void actorId;
    void input;
    return Promise.resolve({ collectionId, status: 'RECONCILED' });
  }
  public getPayoutEligibility(captainId: string, periodStart: string, periodEnd: string) {
    void periodStart;
    void periodEnd;
    return Promise.resolve({ captainId, eligible: true });
  }
  public createPayout(actorId: string, input: CreateCaptainPayoutInput) {
    void actorId;
    return Promise.resolve({ payoutId: ID, captainId: input.captainId });
  }
  public getPayout(payoutId: string) {
    return Promise.resolve({ payoutId });
  }
}

describe('CaptainFinanceService', () => {
  it('reconciles COD using the frozen reason code', async () => {
    const service = new CaptainFinanceService(new GatewayStub());
    const result = await service.reconcileCod(CONTEXT, ID, KEY, {
      depositedAmountPaise: 12000,
      reasonCode: 'COD_RECONCILIATION',
    });
    expect(result.data).toEqual({ collectionId: ID, status: 'RECONCILED' });
  });
});
