import { describe, expect, it } from 'vitest';

import {
  AdminContractError,
  parseCityControlPlane,
  parseCityMutationResult,
  parseCityPreflightResult,
} from '../../admin/admin-contracts';
import { FixtureAdminPort } from '../../admin/admin-fixture';

const CITY_ID = '70000000-0000-4000-8000-000000000001';
const NOW = '2026-07-28T10:00:00.000Z';

const controlPlane = {
  city: {
    id: CITY_ID,
    code: 'TIRUPATI',
    slug: 'tirupati',
    name: 'Tirupati',
    stateCode: 'AP',
    countryCode: 'IN',
    status: 'READY_FOR_VALIDATION',
    activatedAt: null,
    pausedAt: null,
    closedAt: null,
    updatedAt: NOW,
  },
  configuration: {
    cityId: CITY_ID,
    timezone: 'Asia/Kolkata',
    defaultCodLimitPaise: 200000,
    defaultDeliveryRadiusMeters: 5000,
    maximumDeliveryRadiusMeters: 15000,
    baseDeliveryFeePaise: 0,
    perKmDeliveryFeePaise: 1000,
    merchantCommissionBps: 500,
    localDeliveryEnabled: true,
    postalDeliveryEnabled: false,
    operatingHours: { monday: ['09:00', '21:00'] },
    holidayDates: [],
    cancellationPolicy: { version: 1 },
    refundPolicy: { version: 1 },
    version: 2,
    updatedAt: NOW,
  },
  readiness: {
    cityId: CITY_ID,
    activeCaptainCount: 5,
    standbyCaptainCount: 2,
    paymentProviderHealthy: true,
    smsOtpProviderHealthy: true,
    fcmProviderHealthy: true,
    observabilityHealthy: true,
    validationOrderId: null,
    unresolvedHighBlockers: 0,
    version: 3,
    updatedAt: NOW,
  },
  zones: [
    {
      id: '71000000-0000-4000-8000-000000000001',
      cityId: CITY_ID,
      code: 'TIRUPATI-CENTRAL',
      slug: 'tirupati-central',
      name: 'Tirupati Central',
      status: 'READY_FOR_VALIDATION',
      defaultDeliveryRadiusMeters: 6000,
      version: 1,
      updatedAt: NOW,
      pincodes: [
        {
          id: '72000000-0000-4000-8000-000000000001',
          pincode: '517501',
          priority: 1,
          isPrimary: true,
          isActive: true,
          version: 1,
        },
      ],
    },
  ],
  latestPreflight: null,
};

const preflight = {
  id: '73000000-0000-4000-8000-000000000001',
  cityId: CITY_ID,
  cityConfigurationVersion: 2,
  readinessVersion: 3,
  cityStatus: 'READY_FOR_VALIDATION',
  checks: {
    configurationComplete: { passed: true },
    merchants: { passed: false, activeMerchants: 1, minimumActiveMerchants: 5 },
  },
  passed: false,
  createdAt: NOW,
};

describe('Phase 2E city admin contracts', () => {
  it('strictly parses the city, configuration, readiness, zone and pincode projection', () => {
    const parsed = parseCityControlPlane(controlPlane);
    expect(parsed.city.name).toBe('Tirupati');
    expect(parsed.configuration.defaultCodLimitPaise).toBe(200000);
    expect(parsed.zones[0]?.pincodes[0]?.pincode).toBe('517501');
  });

  it('retains idempotent mutation results and immutable preflight evidence', () => {
    expect(parseCityMutationResult({ replayed: true, controlPlane }).replayed).toBe(true);
    expect(parseCityPreflightResult({ report: preflight })).toMatchObject({
      passed: false,
      cityConfigurationVersion: 2,
      readinessVersion: 3,
    });
  });

  it('fails closed for unknown lifecycle values and malformed evidence', () => {
    expect(() =>
      parseCityControlPlane({
        ...controlPlane,
        city: { ...controlPlane.city, status: 'LIVE_WITHOUT_PREFLIGHT' },
      }),
    ).toThrow(AdminContractError);
    expect(() => parseCityPreflightResult({ report: { ...preflight, checks: [] } })).toThrow(
      AdminContractError,
    );
  });

  it('supports the complete fixture journey without direct database access', async () => {
    const port = new FixtureAdminPort();
    const cities = await port.cities();
    expect(cities.kind).toBe('SUCCESS');
    const report = await port.runCityPreflight(CITY_ID, {
      reasonCode: 'OPERATIONAL_RECOVERY',
      note: 'Test fixture',
      idempotencyKey: '74000000-0000-4000-8000-000000000001',
    });
    expect(report.kind === 'SUCCESS' ? report.data.passed : null).toBe(false);
    const activated = await port.activateCity(CITY_ID, {
      reasonCode: 'OPERATIONAL_RECOVERY',
      note: 'Test fixture',
      idempotencyKey: '75000000-0000-4000-8000-000000000001',
    });
    expect(activated.kind === 'SUCCESS' ? activated.data.controlPlane.city.status : null).toBe(
      'ACTIVE',
    );
  });
});
