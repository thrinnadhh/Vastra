import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminCityGateway } from './admin-city.gateway';
import { AdminCityVersionConflictError } from './admin-city.gateway';
import { AdminCityService } from './admin-city.service';
import type {
  AdminCityControlPlane,
  AdminCityMutationResult,
  AdminCityPreflightResult,
  AdminRunCityPreflightInput,
  AdminTransitionCityInput,
  AdminUpdateCityConfigurationInput,
  AdminUpdateCityReadinessInput,
  AdminUpsertServiceZoneInput,
  AdminUpsertServiceZonePincodeInput,
} from './admin-city.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CITY_ID = '20000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '30000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;
const CONTROL_PLANE = {} as AdminCityControlPlane;

class GatewayStub implements AdminCityGateway {
  public configurationInput: AdminUpdateCityConfigurationInput | null = null;
  public transitionInput: AdminTransitionCityInput | null = null;
  public failWithVersionConflict = false;

  public list() {
    return Promise.resolve([]);
  }
  public get() {
    return Promise.resolve(CONTROL_PLANE);
  }
  public updateConfiguration(input: AdminUpdateCityConfigurationInput) {
    if (this.failWithVersionConflict) return Promise.reject(new AdminCityVersionConflictError());
    this.configurationInput = input;
    return Promise.resolve({ replayed: false, controlPlane: CONTROL_PLANE });
  }
  public upsertZone(input: AdminUpsertServiceZoneInput): Promise<AdminCityMutationResult> {
    void input;
    return Promise.resolve({ replayed: false, controlPlane: CONTROL_PLANE });
  }
  public upsertPincode(
    input: AdminUpsertServiceZonePincodeInput,
  ): Promise<AdminCityMutationResult> {
    void input;
    return Promise.resolve({ replayed: false, controlPlane: CONTROL_PLANE });
  }
  public updateReadiness(input: AdminUpdateCityReadinessInput): Promise<AdminCityMutationResult> {
    void input;
    return Promise.resolve({ replayed: false, controlPlane: CONTROL_PLANE });
  }
  public runPreflight(input: AdminRunCityPreflightInput): Promise<AdminCityPreflightResult> {
    void input;
    return Promise.resolve({ replayed: false, report: {} as AdminCityPreflightResult['report'] });
  }
  public transition(input: AdminTransitionCityInput): Promise<AdminCityMutationResult> {
    this.transitionInput = input;
    return Promise.resolve({ replayed: false, controlPlane: CONTROL_PLANE });
  }
}

describe('AdminCityService', () => {
  it('builds an optimistic, reasoned and idempotent city configuration command', async () => {
    const gateway = new GatewayStub();
    const service = new AdminCityService(gateway);

    await service.updateConfiguration(CONTEXT, CITY_ID, IDEMPOTENCY_KEY, 'request-1', {
      expectedVersion: 3,
      patch: { defaultCodLimitPaise: 250000, localDeliveryEnabled: true },
      reasonCode: 'DATA_CORRECTION',
      note: 'Approved city commercial correction',
    });

    expect(gateway.configurationInput).toStrictEqual({
      actorId: ACTOR_ID,
      cityId: CITY_ID,
      expectedVersion: 3,
      patch: { defaultCodLimitPaise: 250000, localDeliveryEnabled: true },
      reasonCode: 'DATA_CORRECTION',
      note: 'Approved city commercial correction',
      requestId: 'request-1',
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it('rejects unsupported configuration fields before reaching the gateway', () => {
    const service = new AdminCityService(new GatewayStub());
    expect(() =>
      service.updateConfiguration(CONTEXT, CITY_ID, IDEMPOTENCY_KEY, null, {
        expectedVersion: 1,
        patch: { databasePassword: 'not-allowed' },
        reasonCode: 'OTHER',
      }),
    ).toThrow(BadRequestException);
  });

  it('maps authoritative version conflicts to HTTP 409', async () => {
    const gateway = new GatewayStub();
    gateway.failWithVersionConflict = true;
    const service = new AdminCityService(gateway);

    await expect(
      service.updateConfiguration(CONTEXT, CITY_ID, IDEMPOTENCY_KEY, null, {
        expectedVersion: 1,
        patch: { timezone: 'Asia/Kolkata' },
        reasonCode: 'DATA_CORRECTION',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('builds activation only as a reasoned global lifecycle command', async () => {
    const gateway = new GatewayStub();
    const service = new AdminCityService(gateway);
    await service.transition(
      CONTEXT,
      CITY_ID,
      IDEMPOTENCY_KEY,
      null,
      {
        reasonCode: 'OPERATIONAL_RECOVERY',
        note: 'Activation preflight reviewed',
      },
      'ACTIVE',
    );
    expect(gateway.transitionInput).toEqual(
      expect.objectContaining({ cityId: CITY_ID, targetStatus: 'ACTIVE' }),
    );
  });
});
