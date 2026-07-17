import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CaptainPresenceController } from './captain-presence.controller';
import type { CaptainPresenceGateway } from './captain-presence.gateway';
import { CaptainPresenceLocationStaleError } from './captain-presence.gateway';
import { CaptainPresenceService } from './captain-presence.service';
import { CAPTAIN_PRESENCE_GATEWAY } from './captain-presence.tokens';
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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

class IntegrationGateway implements CaptainPresenceGateway {
  public stale = false;

  public setAvailability(
    actorId: string,
    status: CaptainClientAvailabilityStatus,
  ): Promise<CaptainAvailabilitySnapshot> {
    if (this.stale) return Promise.reject(new CaptainPresenceLocationStaleError());

    return Promise.resolve({
      captainId: actorId,
      requestedStatus: status,
      availabilityStatus: status,
      changed: true,
      dispatchEligible: status === 'AVAILABLE',
      location: null,
      changedAt: '2026-07-17T10:00:01.000Z',
    });
  }

  public updateLocation(command: UpdateCaptainLocationCommand): Promise<CaptainLocationSnapshot> {
    return Promise.resolve({
      captainId: command.actorId,
      sampleId: command.sampleId,
      recordedAt: command.recordedAt,
      acceptedAt: '2026-07-17T10:00:01.000Z',
      accuracyMeters: command.accuracyMeters,
      activeDeliveryTaskId: command.activeDeliveryTaskId,
      historySampled: true,
      replayed: false,
    });
  }
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!(server instanceof Server)) throw new TypeError('Expected Node HTTP server');
  return server;
}

function readErrorCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const nested = (body as Record<string, unknown>)['error'];
  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) return null;
  const code = (nested as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : null;
}

function readNestedString(
  body: unknown,
  dataKey: string,
  resourceKey: string,
  valueKey: string,
): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const data = (body as Record<string, unknown>)[dataKey];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const resource = (data as Record<string, unknown>)[resourceKey];
  if (typeof resource !== 'object' || resource === null || Array.isArray(resource)) return null;
  const value = (resource as Record<string, unknown>)[valueKey];
  return typeof value === 'string' ? value : null;
}

describe('captain presence integration', () => {
  let app: INestApplication | undefined;
  let server: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();
    const module = await Test.createTestingModule({
      controllers: [CaptainPresenceController],
      providers: [CaptainPresenceService, { provide: CAPTAIN_PRESENCE_GATEWAY, useValue: gateway }],
    }).compile();

    const application = module.createNestApplication();
    application.use(
      (incoming: AuthenticatedHttpRequest, _response: unknown, next: () => void): void => {
        incoming.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    server = requireHttpServer(application);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sets captain availability through the frozen endpoint', async () => {
    const response = await request(server)
      .put('/captain/me/availability')
      .send({ status: 'AVAILABLE' });

    expect(response.status).toBe(200);
    expect(readNestedString(response.body, 'data', 'availability', 'availabilityStatus')).toBe(
      'AVAILABLE',
    );
  });

  it('accepts a client-deduplicated location sample', async () => {
    const response = await request(server).put('/captain/me/location').send({
      sampleId: SAMPLE_ID,
      latitude: 13.6288,
      longitude: 79.4192,
      accuracyMeters: 12,
      recordedAt: '2026-07-17T10:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(readNestedString(response.body, 'data', 'location', 'sampleId')).toBe(SAMPLE_ID);
  });

  it('returns the frozen stale-location conflict', async () => {
    gateway.stale = true;
    const response = await request(server)
      .put('/captain/me/availability')
      .send({ status: 'AVAILABLE' });

    expect(response.status).toBe(409);
    expect(readErrorCode(response.body)).toBe('CAPTAIN_LOCATION_STALE');
  });
});
