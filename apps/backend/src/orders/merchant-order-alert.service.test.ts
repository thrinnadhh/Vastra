import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOrderAlertGateway,
  MerchantOrderAlertDataInvalidError,
  MerchantOrderAlertExpiredError,
  MerchantOrderAlertGatewayUnavailableError,
  MerchantOrderAlertNotAcknowledgeableError,
  MerchantOrderAlertNotFoundError,
} from './merchant-order-alert.gateway';
import { MerchantOrderAlertService } from './merchant-order-alert.service';
import type { MerchantOrderAlertAcknowledgement } from './merchant-order-alert.types';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ALERT_ID = '20000000-0000-4000-8000-000000000001';

const context = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'test-token',
  supabase: Object.freeze({}),
} as unknown as AuthenticatedRequestContext;

function createAcknowledgement(replayed = false): MerchantOrderAlertAcknowledgement {
  return {
    id: ALERT_ID,
    orderId: '30000000-0000-4000-8000-000000000001',
    shopId: '40000000-0000-4000-8000-000000000001',
    status: 'ACKNOWLEDGED',
    attemptCount: 0,
    firstSentAt: null,
    lastSentAt: null,
    acknowledgedAt: '2026-07-15T20:05:00.000Z',
    acknowledgedBy: ACTOR_ID,
    expiresAt: '2026-07-15T20:15:00.000Z',
    soundName: 'vastra_new_order',
    failureReason: null,
    reminderEligible: false,
    soundShouldStop: true,
    replayed,
  };
}

class StubGateway implements MerchantOrderAlertGateway {
  public actorId: string | null = null;
  public alertId: string | null = null;
  public result = createAcknowledgement();
  public error: Error | null = null;

  public acknowledgeAlert(
    actorId: string,
    alertId: string,
  ): Promise<MerchantOrderAlertAcknowledgement> {
    this.actorId = actorId;
    this.alertId = alertId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.result);
  }
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw error;
  }

  const response = error.getResponse();
  if (typeof response !== 'object') {
    throw new TypeError('Expected structured error response');
  }

  const errorValue = (response as Record<string, unknown>)['error'];
  if (typeof errorValue !== 'object' || errorValue === null) {
    throw new TypeError('Expected API error payload');
  }

  const code = (errorValue as Record<string, unknown>)['code'];
  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code');
  }

  return code;
}

describe('merchant order alert service', () => {
  it('acknowledges one owned alert and tells the client to stop sound', async () => {
    const gateway = new StubGateway();
    const service = new MerchantOrderAlertService(gateway);
    const response = await service.acknowledgeAlert(context, ALERT_ID);

    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.alertId).toBe(ALERT_ID);
    expect(response.data.alert).toStrictEqual(createAcknowledgement());
    expect(response.data.alert.soundShouldStop).toBe(true);
    expect(response.data.alert.reminderEligible).toBe(false);
  });

  it('returns the gateway replay marker for repeated acknowledgement', async () => {
    const gateway = new StubGateway();
    gateway.result = createAcknowledgement(true);
    const service = new MerchantOrderAlertService(gateway);

    expect((await service.acknowledgeAlert(context, ALERT_ID)).data.alert.replayed).toBe(true);
  });

  it('maps invalid identifiers to validation errors', async () => {
    const service = new MerchantOrderAlertService(new StubGateway());

    await expect(service.acknowledgeAlert(context, 'invalid')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_BAD_REQUEST &&
        readErrorCode(error) === 'VALIDATION_ERROR',
    );
  });

  it('maps inaccessible alerts to not found', async () => {
    const gateway = new StubGateway();
    gateway.error = new MerchantOrderAlertNotFoundError();
    const service = new MerchantOrderAlertService(gateway);

    await expect(service.acknowledgeAlert(context, ALERT_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_NOT_FOUND &&
        readErrorCode(error) === 'MERCHANT_ORDER_ALERT_NOT_FOUND',
    );
  });

  it('maps expired response windows to conflict', async () => {
    const gateway = new StubGateway();
    gateway.error = new MerchantOrderAlertExpiredError();
    const service = new MerchantOrderAlertService(gateway);

    await expect(service.acknowledgeAlert(context, ALERT_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_CONFLICT &&
        readErrorCode(error) === 'MERCHANT_RESPONSE_EXPIRED',
    );
  });

  it('maps non-waiting orders to invalid state', async () => {
    const gateway = new StubGateway();
    gateway.error = new MerchantOrderAlertNotAcknowledgeableError();
    const service = new MerchantOrderAlertService(gateway);

    await expect(service.acknowledgeAlert(context, ALERT_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_CONFLICT &&
        readErrorCode(error) === 'INVALID_ORDER_STATE',
    );
  });

  it('maps malformed provider data to an internal error', async () => {
    const gateway = new StubGateway();
    gateway.error = new MerchantOrderAlertDataInvalidError();
    const service = new MerchantOrderAlertService(gateway);

    await expect(service.acknowledgeAlert(context, ALERT_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_INTERNAL_SERVER_ERROR &&
        readErrorCode(error) === 'INTERNAL_ERROR',
    );
  });

  it('maps provider outages to a retryable service error', async () => {
    const gateway = new StubGateway();
    gateway.error = new MerchantOrderAlertGatewayUnavailableError();
    const service = new MerchantOrderAlertService(gateway);

    await expect(service.acknowledgeAlert(context, ALERT_ID)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === HTTP_SERVICE_UNAVAILABLE &&
        readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
