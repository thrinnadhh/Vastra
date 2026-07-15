import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantOrderAlertController } from './merchant-order-alert.controller';
import type { MerchantOrderAlertGateway } from './merchant-order-alert.gateway';
import { MerchantOrderAlertService } from './merchant-order-alert.service';
import { MERCHANT_ORDER_ALERT_GATEWAY } from './merchant-order-alert.tokens';
import type { MerchantOrderAlertAcknowledgement } from './merchant-order-alert.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ALERT_ID = '20000000-0000-4000-8000-000000000001';

const context = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: Object.freeze({}),
} as unknown as AuthenticatedRequestContext;

function createAcknowledgement(): MerchantOrderAlertAcknowledgement {
  return {
    id: ALERT_ID,
    orderId: '30000000-0000-4000-8000-000000000001',
    shopId: '40000000-0000-4000-8000-000000000001',
    status: 'ACKNOWLEDGED',
    attemptCount: 1,
    firstSentAt: '2026-07-15T20:01:00.000Z',
    lastSentAt: '2026-07-15T20:01:00.000Z',
    acknowledgedAt: '2026-07-15T20:05:00.000Z',
    acknowledgedBy: ACTOR_ID,
    expiresAt: '2026-07-15T20:15:00.000Z',
    soundName: 'vastra_new_order',
    failureReason: null,
    reminderEligible: false,
    soundShouldStop: true,
    replayed: false,
  };
}

class IntegrationGateway implements MerchantOrderAlertGateway {
  public actorId: string | null = null;
  public alertId: string | null = null;

  public acknowledgeAlert(
    actorId: string,
    alertId: string,
  ): Promise<MerchantOrderAlertAcknowledgement> {
    this.actorId = actorId;
    this.alertId = alertId;
    return Promise.resolve(createAcknowledgement());
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readData(body: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(body, 'response')['data'], 'response data');
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];
  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('merchant order alert integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantOrderAlertController],
      providers: [
        MerchantOrderAlertService,
        {
          provide: MERCHANT_ORDER_ALERT_GATEWAY,
          useValue: gateway,
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
        incomingRequest.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('acknowledges an alert through POST /merchant/order-alerts/:alertId/acknowledge', async () => {
    const response = await request(httpServer).post(
      `/merchant/order-alerts/${ALERT_ID}/acknowledge`,
    );

    expect(response.status).toBe(200);
    const alert = requireRecord(readData(response.body)['alert'], 'alert');
    expect(alert['id']).toBe(ALERT_ID);
    expect(alert['status']).toBe('ACKNOWLEDGED');
    expect(alert['soundShouldStop']).toBe(true);
    expect(alert['reminderEligible']).toBe(false);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.alertId).toBe(ALERT_ID);
  });

  it('rejects an invalid alert identifier', async () => {
    const response = await request(httpServer).post('/merchant/order-alerts/invalid/acknowledge');

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
