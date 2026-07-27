import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantDashboardGateway } from './merchant-dashboard.gateway';
import { MerchantDashboardService } from './merchant-dashboard.service';

const MERCHANT_ID = '10000000-0000-4000-8000-000000000001';
const CONTEXT = {
  actor: { id: MERCHANT_ID },
} as AuthenticatedRequestContext;

class GatewayStub implements MerchantDashboardGateway {
  public merchantId: string | null = null;

  public get(merchantId: string) {
    this.merchantId = merchantId;
    return Promise.resolve({
      shop: {
        id: '20000000-0000-4000-8000-000000000001',
        name: 'Vastra Test Shop',
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
      },
      orders: {
        waitingForMerchant: 1,
        packing: 2,
        readyForPickup: 1,
        activeDelivery: 3,
        problemReported: 0,
      },
      alerts: { unacknowledged: 1 },
      inventory: { lowStockVariants: 4 },
      sales: { completedToday: 5, grossTodayPaise: 120000 },
      generatedAt: '2026-07-26T10:00:00.000Z',
    });
  }
}

describe('MerchantDashboardService', () => {
  it('loads only the authenticated merchant dashboard', async () => {
    const gateway = new GatewayStub();
    const service = new MerchantDashboardService(gateway);

    const result = await service.get(CONTEXT);

    expect(gateway.merchantId).toBe(MERCHANT_ID);
    expect(result.data.dashboard.sales.grossTodayPaise).toBe(120000);
    expect(result.meta.requestId).toBeNull();
  });
});
