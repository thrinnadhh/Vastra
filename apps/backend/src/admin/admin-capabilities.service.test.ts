import { describe, expect, it } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminCapabilitiesGateway } from './admin-capabilities.gateway';
import { AdminCapabilitiesService } from './admin-capabilities.service';

class GatewayStub implements AdminCapabilitiesGateway {
  public listGrantedPermissions(client: SupabaseClient) {
    void client;
    return Promise.resolve(['admin.dashboard.read', 'admin.orders.read'] as const);
  }
}

describe('AdminCapabilitiesService', () => {
  it('exposes the current assurance level and only granted admin permissions', async () => {
    const context = {
      assuranceLevel: 'aal1',
      supabase: {} as SupabaseClient,
    } as AuthenticatedRequestContext;

    await expect(
      new AdminCapabilitiesService(new GatewayStub()).get(context),
    ).resolves.toStrictEqual({
      success: true,
      data: {
        assuranceLevel: 'aal1',
        permissions: ['admin.dashboard.read', 'admin.orders.read'],
        mfaRequiredForSensitiveOperations: true,
      },
      meta: { requestId: null },
    });
  });
});
