import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import {
  AdminCityGatewayUnavailableError,
  AdminCityVersionConflictError,
  SupabaseAdminCityGateway,
} from './admin-city.gateway';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CITY_ID = '20000000-0000-4000-8000-000000000001';

function controlPlane() {
  return {
    city: {
      id: CITY_ID,
      code: 'TIRUPATI',
      slug: 'tirupati',
      name: 'Tirupati',
      state_code: 'AP',
      country_code: 'IN',
      status: 'CONFIGURING',
      activated_at: null,
      paused_at: null,
      closed_at: null,
      updated_at: '2026-07-28T00:00:00.000Z',
    },
    configuration: {
      city_id: CITY_ID,
      timezone: 'Asia/Kolkata',
      default_cod_limit_paise: 200000,
      default_delivery_radius_meters: 5000,
      maximum_delivery_radius_meters: 15000,
      base_delivery_fee_paise: 0,
      per_km_delivery_fee_paise: 1000,
      merchant_commission_bps: 500,
      local_delivery_enabled: true,
      postal_delivery_enabled: false,
      operating_hours: { monday: ['09:00', '21:00'] },
      holiday_dates: [],
      cancellation_policy: { version: 1 },
      refund_policy: { version: 1 },
      version: 2,
      updated_at: '2026-07-28T00:00:00.000Z',
    },
    readiness: {
      city_id: CITY_ID,
      active_captain_count: 0,
      standby_captain_count: 0,
      payment_provider_healthy: false,
      sms_otp_provider_healthy: false,
      fcm_provider_healthy: false,
      observability_healthy: false,
      validation_order_id: null,
      unresolved_high_blockers: 0,
      version: 1,
      updated_at: '2026-07-28T00:00:00.000Z',
    },
    zones: [],
    latestPreflight: null,
  };
}

describe('SupabaseAdminCityGateway', () => {
  it('strictly parses the city control-plane read model', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: controlPlane(), error: null });
    const gateway = new SupabaseAdminCityGateway({ rpc } as unknown as SupabaseClient);
    const result = await gateway.get(ACTOR_ID, CITY_ID);
    expect(result.city).toEqual(expect.objectContaining({ id: CITY_ID, name: 'Tirupati' }));
    expect(result.configuration.version).toBe(2);
  });

  it('fails closed on malformed database payloads', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { city: {} }, error: null });
    const gateway = new SupabaseAdminCityGateway({ rpc } as unknown as SupabaseClient);
    await expect(gateway.get(ACTOR_ID, CITY_ID)).rejects.toBeInstanceOf(
      AdminCityGatewayUnavailableError,
    );
  });

  it('maps database version conflicts without losing the authoritative error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'ADMIN_CITY_CONFIGURATION_VERSION_CONFLICT' },
    });
    const gateway = new SupabaseAdminCityGateway({ rpc } as unknown as SupabaseClient);
    await expect(
      gateway.updateConfiguration({
        actorId: ACTOR_ID,
        cityId: CITY_ID,
        expectedVersion: 1,
        patch: { timezone: 'Asia/Kolkata' },
        reasonCode: 'DATA_CORRECTION',
        note: null,
        requestId: null,
        idempotencyKey: '30000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(AdminCityVersionConflictError);
  });
});
