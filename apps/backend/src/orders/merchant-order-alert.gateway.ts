import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { MerchantOrderAlertAcknowledgement } from './merchant-order-alert.types';

export interface MerchantOrderAlertGateway {
  acknowledgeAlert(actorId: string, alertId: string): Promise<MerchantOrderAlertAcknowledgement>;
}

export class MerchantOrderAlertGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant order alert provider unavailable');
    this.name = 'MerchantOrderAlertGatewayUnavailableError';
  }
}

export class MerchantOrderAlertDataInvalidError extends Error {
  public constructor() {
    super('Merchant order alert data invalid');
    this.name = 'MerchantOrderAlertDataInvalidError';
  }
}

export class MerchantOrderAlertNotFoundError extends Error {
  public constructor() {
    super('Merchant order alert not found');
    this.name = 'MerchantOrderAlertNotFoundError';
  }
}

export class MerchantOrderAlertExpiredError extends Error {
  public constructor() {
    super('Merchant order alert expired');
    this.name = 'MerchantOrderAlertExpiredError';
  }
}

export class MerchantOrderAlertNotAcknowledgeableError extends Error {
  public constructor() {
    super('Merchant order alert is not acknowledgeable');
    this.name = 'MerchantOrderAlertNotAcknowledgeableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function requireNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = requireNullableString(record, key);

  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return value;
}

function parseAcknowledgement(value: unknown): MerchantOrderAlertAcknowledgement {
  if (!isRecord(value)) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  const acknowledgedAt = requireTimestamp(value, 'acknowledgedAt');
  const expiresAt = requireTimestamp(value, 'expiresAt');
  const reminderEligible = requireBoolean(value, 'reminderEligible');
  const soundShouldStop = requireBoolean(value, 'soundShouldStop');

  if (
    value['status'] !== 'ACKNOWLEDGED' ||
    reminderEligible ||
    !soundShouldStop ||
    Date.parse(acknowledgedAt) > Date.parse(expiresAt)
  ) {
    throw new MerchantOrderAlertDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    orderId: requireString(value, 'orderId'),
    shopId: requireString(value, 'shopId'),
    status: 'ACKNOWLEDGED',
    attemptCount: requireNonNegativeInteger(value, 'attemptCount'),
    firstSentAt: requireNullableTimestamp(value, 'firstSentAt'),
    lastSentAt: requireNullableTimestamp(value, 'lastSentAt'),
    acknowledgedAt,
    acknowledgedBy: requireString(value, 'acknowledgedBy'),
    expiresAt,
    soundName: requireString(value, 'soundName'),
    failureReason: requireNullableString(value, 'failureReason'),
    reminderEligible: false,
    soundShouldStop: true,
    replayed: requireBoolean(value, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0014':
      return new MerchantOrderAlertNotFoundError();
    case 'P0015':
      return new MerchantOrderAlertExpiredError();
    case 'P0016':
      return new MerchantOrderAlertNotAcknowledgeableError();
    case undefined:
      return new MerchantOrderAlertGatewayUnavailableError();
    default:
      return new MerchantOrderAlertGatewayUnavailableError();
  }
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantOrderAlertGatewayUnavailableError ||
    error instanceof MerchantOrderAlertDataInvalidError ||
    error instanceof MerchantOrderAlertNotFoundError ||
    error instanceof MerchantOrderAlertExpiredError ||
    error instanceof MerchantOrderAlertNotAcknowledgeableError
  ) {
    throw error;
  }

  throw new MerchantOrderAlertGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantOrderAlertGateway implements MerchantOrderAlertGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async acknowledgeAlert(
    actorId: string,
    alertId: string,
  ): Promise<MerchantOrderAlertAcknowledgement> {
    try {
      const response = await this.trustedClient.rpc('acknowledge_merchant_order_alert', {
        p_actor: actorId,
        p_alert_id: alertId,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseAcknowledgement(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
