import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminOrderInvestigationGateway } from './admin-order-investigation.gateway';
import {
  AdminOrderIdInvalidError,
  AdminOrderInvestigationService,
  AdminOrderNotFoundError,
} from './admin-order-investigation.service';

const CONTEXT = {} as AuthenticatedRequestContext;
const ORDER_ID = '10000000-0000-4000-8000-000000000001';

class GatewayStub implements AdminOrderInvestigationGateway {
  public result: Readonly<Record<string, unknown>> | null = { order: { id: ORDER_ID } };

  public get() {
    return Promise.resolve(this.result);
  }
}

describe('AdminOrderInvestigationService', () => {
  it('rejects malformed identifiers before querying the database', async () => {
    const service = new AdminOrderInvestigationService(new GatewayStub());
    await expect(service.get(CONTEXT, 'not-an-id')).rejects.toBeInstanceOf(
      AdminOrderIdInvalidError,
    );
  });

  it('returns a stable not-found error for missing orders', async () => {
    const gateway = new GatewayStub();
    gateway.result = null;
    const service = new AdminOrderInvestigationService(gateway);
    await expect(service.get(CONTEXT, ORDER_ID)).rejects.toBeInstanceOf(AdminOrderNotFoundError);
  });
});
