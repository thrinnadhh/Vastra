import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminCaptainAvailabilityInput,
  AdminCaptainGateway,
  AdminCaptainMutationInput,
  AdminCaptainStatusInput,
} from './admin-captain.gateway';
import {
  AdminCaptainIdempotencyKeyRequiredError,
  AdminCaptainRequestInvalidError,
  AdminCaptainService,
} from './admin-captain.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CAPTAIN_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements AdminCaptainGateway {
  public input:
    AdminCaptainMutationInput | AdminCaptainStatusInput | AdminCaptainAvailabilityInput | null =
    null;
  public get() {
    return Promise.resolve({ captain: { id: CAPTAIN_ID } });
  }
  public setStatus(input: AdminCaptainStatusInput) {
    this.input = input;
    return Promise.resolve({ captain: { id: CAPTAIN_ID } });
  }
  public correctAvailability(input: AdminCaptainAvailabilityInput) {
    this.input = input;
    return Promise.resolve({ captain: { id: CAPTAIN_ID } });
  }
  public releaseActiveAssignment(input: AdminCaptainMutationInput) {
    this.input = input;
    return Promise.resolve({ captain: { id: CAPTAIN_ID } });
  }
}

describe('AdminCaptainService', () => {
  it('requires idempotency for captain mutations', async () => {
    const service = new AdminCaptainService(new GatewayStub());
    await expect(
      service.setStatus(
        CONTEXT,
        CAPTAIN_ID,
        null,
        null,
        { reasonCode: 'SAFETY_INCIDENT' },
        'SUSPENDED',
      ),
    ).rejects.toBeInstanceOf(AdminCaptainIdempotencyKeyRequiredError);
  });

  it('binds a suspension to the authenticated admin actor', async () => {
    const gateway = new GatewayStub();
    const service = new AdminCaptainService(gateway);
    await service.setStatus(
      CONTEXT,
      CAPTAIN_ID,
      KEY,
      'request-1',
      { reasonCode: 'SAFETY_INCIDENT', note: 'Safety review' },
      'SUSPENDED',
    );
    expect(gateway.input).toMatchObject({
      actorId: ACTOR_ID,
      captainId: CAPTAIN_ID,
      targetStatus: 'SUSPENDED',
    });
  });

  it('rejects assignment-only availability values', async () => {
    const service = new AdminCaptainService(new GatewayStub());
    await expect(
      service.correctAvailability(CONTEXT, CAPTAIN_ID, KEY, null, {
        reasonCode: 'DATA_CORRECTION',
        targetAvailability: 'DELIVERING',
      }),
    ).rejects.toBeInstanceOf(AdminCaptainRequestInvalidError);
  });
});
