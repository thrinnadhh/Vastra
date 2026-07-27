import { describe, expect, it } from 'vitest';

import { parseCapabilities, parseDashboard, parseOperationOutcome } from '../admin/admin-contracts';

describe('FE08 admin contracts', () => {
  it('parses permission and assurance capability envelopes', () => {
    expect(
      parseCapabilities({
        success: true,
        data: {
          assuranceLevel: 'aal2',
          permissions: ['admin.dashboard.read'],
          mfaRequiredForSensitiveOperations: true,
        },
        meta: { requestId: null },
      }),
    ).toStrictEqual({
      assuranceLevel: 'aal2',
      permissions: ['admin.dashboard.read'],
      mfaRequiredForSensitiveOperations: true,
    });
  });

  it('parses truthful dashboard counters without client-derived totals', () => {
    expect(
      parseDashboard({
        openOrders: 9,
        interventionOrders: 2,
        waitingMerchantOrders: 1,
        stuckOrders: 1,
        unassignedDeliveries: 2,
        searchingDeliveries: 2,
        activeDeliveries: 4,
        alertAttention: 1,
        paymentAttention: 0,
        refundAttention: 0,
        openCases: 1,
        suspendedMerchants: 0,
        suspendedCaptains: 0,
        generatedAt: '2026-07-26T10:00:00.000Z',
      }).openOrders,
    ).toBe(9);
  });

  it('retains idempotent replay outcomes', () => {
    expect(
      parseOperationOutcome({ orderId: '10000000-0000-4000-8000-000000000001', replayed: true }),
    ).toStrictEqual({
      replayed: true,
      summary: { orderId: '10000000-0000-4000-8000-000000000001', replayed: true },
    });
  });
});
