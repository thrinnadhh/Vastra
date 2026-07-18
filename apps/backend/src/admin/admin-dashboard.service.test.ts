import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminDashboardGateway } from './admin-dashboard.gateway';
import {
  AdminDashboardService,
  AdminSearchQueryInvalidError,
} from './admin-dashboard.service';

const CONTEXT = {} as AuthenticatedRequestContext;

class GatewayStub implements AdminDashboardGateway {
  public query: string | null = null;
  public limit: number | null = null;

  public getSummary() {
    return Promise.resolve({
      openOrders: 1,
      interventionOrders: 0,
      searchingDeliveries: 0,
      activeDeliveries: 1,
      openCases: 0,
      suspendedMerchants: 0,
      suspendedCaptains: 0,
      generatedAt: '2026-07-18T00:00:00.000Z',
    });
  }

  public search(query: string, limit: number) {
    this.query = query;
    this.limit = limit;
    return Promise.resolve([]);
  }
}

describe('AdminDashboardService', () => {
  it('normalizes search input and bounds result size', async () => {
    const gateway = new GatewayStub();
    const service = new AdminDashboardService(gateway);
    await service.search(CONTEXT, '  VAS-100  ', '999');
    expect(gateway.query).toBe('VAS-100');
    expect(gateway.limit).toBe(50);
  });

  it('rejects short search terms', () => {
    const service = new AdminDashboardService(new GatewayStub());
    expect(() => service.search(CONTEXT, 'x', undefined)).toThrow(AdminSearchQueryInvalidError);
  });
});
