import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const OPENAPI = readFileSync(resolve(__dirname, '../../../../docs/api/openapi.yaml'), 'utf8');

const FE_S08_OPERATION_IDS = [
  'getAdminCapabilities',
  'getAdminOperationsDashboard',
  'searchAdminOperations',
  'listAdminOperationalOrders',
  'getAdminOrderInvestigation',
  'cancelAdminOrderOperation',
  'retryAdminOrderDispatch',
  'releaseAdminDeliveryOperation',
  'resetAdminDeliveryVerification',
  'listAdminMerchants',
  'getAdminMerchantOperations',
  'approveAdminMerchant',
  'pauseAdminMerchantOrders',
  'suspendAdminMerchant',
  'restoreAdminMerchant',
  'listAdminCaptains',
  'getAdminCaptainOperations',
  'approveAdminCaptain',
  'suspendAdminCaptain',
  'restoreAdminCaptain',
  'correctAdminCaptainAvailability',
  'releaseAdminCaptainAssignment',
  'listAdminAudit',
] as const;

const STALE_PLACEHOLDER_OPERATION_IDS = ['assignCaptainToAdminOrder'] as const;

describe('Frontend Sprint 8 admin OpenAPI parity', () => {
  it('contracts every observation and recovery operation used by the admin frontend', () => {
    for (const operationId of FE_S08_OPERATION_IDS) {
      expect(OPENAPI).toContain(`operationId: ${operationId}`);
    }
  });

  it('does not advertise unsupported order-level assignment commands', () => {
    for (const operationId of STALE_PLACEHOLDER_OPERATION_IDS) {
      expect(OPENAPI).not.toContain(`operationId: ${operationId}`);
    }
  });
});
