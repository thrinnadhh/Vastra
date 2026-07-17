import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CaptainPresenceGateway,
  CaptainPresenceLocationStaleError,
  CaptainPresenceRateLimitedError,
  CaptainPresenceStateConflictError,
} from './captain-presence.gateway';
import { CaptainPresenceService } from './captain-presence.service';
import type {
  CaptainAvailabilitySnapshot,
  CaptainClientAvailabilityStatus,
  CaptainLocationSnapshot,
  UpdateCaptainLocationCommand,
} from './captain-presence.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SAMPLE_ID = '20000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'captain@example.test',
    accountType: 'CAPTAIN',
    status: 'ACTIVE',
  },
  accessToken: 'unit-test-token',
  supabase: emptyClient,
};

function availability(status: CaptainClientAvailabilityStatus): CaptainAvailabilitySnapshot {
  return {
    captainId: ACTOR_ID,
    requestedStatus: status,
    availabilityStatus: status,
    changed: true,
    dispatchEligible: status === 'AVAILABLE',
    location: {
      recordedAt: '2026-07-17T10:00:00.000Z',
      accuracyMeters: 12,
      fresh: true,
      activeDeliveryTaskId: null,
    },
    changedAt: '2026-07-17T10:00:01.000Z',
  };
}

function location(): CaptainLocationSnapshot {
  return {
    captainId: ACTOR_ID,
    sampleId: SAMPLE_ID,
    recordedAt: '2026-07-17T10:00:00.000Z',
    acceptedAt: '2026-07-17T10:00:01.000Z',
    accuracyMeters: 12,
    activeDeliveryTaskId: null,
    historySampled: true,
    replayed: false,
  };
}

class StubGateway implements CaptainPresenceGateway {
  public error: Error | null = null;
  public lastStatus: CaptainClientAvailabilityStatus | null = null;
  public lastLocation: UpdateCaptainLocationCommand | null = null;

  public setAvailability(
    _actorId: string,
    status: CaptainClientAvailabilityStatus,
  ): Promise<CaptainAvailabilitySnapshot> {
    this.lastStatus = status;
    return this.error === null ? Promise.resolve(availability(status)) : Promise.reject(this.error);
  }

  public updateLocation(command: UpdateCaptainLocationCommand): Promise<CaptainLocationSnapshot> {
    this.lastLocation = command;
    return this.error === null ? Promise.resolve(location()) : Promise.reject(this.error);
  }
}

function readErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpException)) return null;
  const response = error.getResponse();
  if (typeof response !== 'object' || response === null || Array.isArray(response)) return null;
  const body = response as Record<string, unknown>;
  const nested = body['error'];
  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) return null;
  const code = (nested as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : null;
}

describe('CaptainPresenceService', () => {
  let gateway: StubGateway;
  let service: CaptainPresenceService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CaptainPresenceService(gateway);
  });

  it('sets an authoritative captain availability state', async () => {
    const response = await service.setAvailability(context, { status: 'AVAILABLE' });

    expect(gateway.lastStatus).toBe('AVAILABLE');
    expect(response.data.availability.dispatchEligible).toBe(true);
  });

  it('passes the authenticated actor into location writes', async () => {
    await service.updateLocation(context, {
      sampleId: SAMPLE_ID,
      latitude: 13.6288,
      longitude: 79.4192,
      accuracyMeters: 12,
      recordedAt: '2026-07-17T10:00:00.000Z',
    });

    expect(gateway.lastLocation?.actorId).toBe(ACTOR_ID);
    expect(gateway.lastLocation?.activeDeliveryTaskId).toBeNull();
  });

  it.each([
    [new CaptainPresenceLocationStaleError(), 'CAPTAIN_LOCATION_STALE'],
    [new CaptainPresenceRateLimitedError(), 'LOCATION_UPDATE_RATE_LIMITED'],
    [new CaptainPresenceStateConflictError(), 'DELIVERY_STATE_CONFLICT'],
  ])('maps gateway failures to stable delivery errors', async (error, code) => {
    gateway.error = error;

    await expect(
      service.setAvailability(context, { status: 'AVAILABLE' }),
    ).rejects.toSatisfy((candidate: unknown) => readErrorCode(candidate) === code);
  });
});
