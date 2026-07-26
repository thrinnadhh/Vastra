import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminDashboardGateway, AdminOrderListInput } from './admin-dashboard.gateway';
import {
  AdminDashboardService,
  AdminOrderListQueryInvalidError,
  AdminSearchQueryInvalidError,
} from './admin-dashboard.service';

const CONTEXT = {} as AuthenticatedRequestContext;

class GatewayStub implements AdminDashboardGateway {
  public query: string | null = null;
  public limit: number | null = null;
  public orderInput: AdminOrderListInput | null = null;

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

  public listOrders(input: AdminOrderListInput) {
    this.orderInput = input;
    return Promise.resolve({ orders: [], nextCursor: null });
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

  it('parses a bounded operational order query', async () => {
    const gateway = new GatewayStub();
    const service = new AdminDashboardService(gateway);

    await service.listOrders(CONTEXT, 'CAPTAIN_SEARCHING', 'UNASSIGNED', undefined, '999');

    expect(gateway.orderInput).toEqual({
      status: 'CAPTAIN_SEARCHING',
      issue: 'UNASSIGNED',
      cursorCreatedAt: null,
      cursorId: null,
      limit: 50,
    });
  });

  it('rejects unknown order statuses and issue filters', async () => {
    const service = new AdminDashboardService(new GatewayStub());

    await expect(
      service.listOrders(CONTEXT, 'UNKNOWN', undefined, undefined, undefined),
    ).rejects.toBeInstanceOf(AdminOrderListQueryInvalidError);
    await expect(
      service.listOrders(CONTEXT, undefined, 'UNKNOWN', undefined, undefined),
    ).rejects.toBeInstanceOf(AdminOrderListQueryInvalidError);
  });
});
