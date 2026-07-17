import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  MERCHANT_ALERT_STOP_REASONS,
  type CompleteMerchantAlertDispatchCommand,
  type CompleteMerchantAlertDispatchResult,
  type MerchantAlertDeliveryGateway,
  type MerchantAlertDeviceDestination,
  type MerchantAlertDispatchClaim,
  type MerchantAlertStopReason,
} from './merchant-alert-delivery.types';

const OUTBOX_COMPLETION_STATUSES = ['PUBLISHED', 'FAILED', 'DEAD_LETTER'] as const;
const MERCHANT_ALERT_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'EXPIRED',
  'FAILED',
] as const;

export class MerchantAlertDeliveryGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant alert delivery provider unavailable');
    this.name = 'MerchantAlertDeliveryGatewayUnavailableError';
  }
}

export class MerchantAlertDeliveryDataInvalidError extends Error {
  public constructor() {
    super('Merchant alert delivery provider returned invalid data');
    this.name = 'MerchantAlertDeliveryDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantAlertDeliveryDataInvalidError();
  }
  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new MerchantAlertDeliveryDataInvalidError();
  return value;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number.NaN;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumber(record[key]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MerchantAlertDeliveryDataInvalidError();
  }
  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);
  if (value < 1) throw new MerchantAlertDeliveryDataInvalidError();
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new MerchantAlertDeliveryDataInvalidError();
  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new MerchantAlertDeliveryDataInvalidError();
  return value;
}

function requireNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = requireNullableString(record, key);
  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new MerchantAlertDeliveryDataInvalidError();
  }
  return value;
}

function parseStopReason(value: unknown): MerchantAlertStopReason | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new MerchantAlertDeliveryDataInvalidError();

  for (const candidate of MERCHANT_ALERT_STOP_REASONS) {
    if (candidate === value) return candidate;
  }

  throw new MerchantAlertDeliveryDataInvalidError();
}

function parseEventStatus(value: unknown): CompleteMerchantAlertDispatchResult['eventStatus'] {
  if (typeof value !== 'string') throw new MerchantAlertDeliveryDataInvalidError();

  for (const candidate of OUTBOX_COMPLETION_STATUSES) {
    if (candidate === value) return candidate;
  }

  throw new MerchantAlertDeliveryDataInvalidError();
}

function parseAlertStatus(value: unknown): CompleteMerchantAlertDispatchResult['alertStatus'] {
  if (typeof value !== 'string') throw new MerchantAlertDeliveryDataInvalidError();

  for (const candidate of MERCHANT_ALERT_STATUSES) {
    if (candidate === value) return candidate;
  }

  throw new MerchantAlertDeliveryDataInvalidError();
}

function parseDevice(value: unknown): MerchantAlertDeviceDestination {
  if (!isRecord(value)) throw new MerchantAlertDeliveryDataInvalidError();
  return {
    deviceId: requireString(value, 'deviceId'),
    pushToken: requireString(value, 'pushToken'),
  };
}

function parseClaim(value: unknown): MerchantAlertDispatchClaim {
  if (!isRecord(value)) throw new MerchantAlertDeliveryDataInvalidError();
  const rawDevices: unknown = value['devices'];
  if (!Array.isArray(rawDevices)) throw new MerchantAlertDeliveryDataInvalidError();
  const devicesValue: readonly unknown[] = rawDevices;

  const deliverable = requireBoolean(value, 'deliverable');
  const stopReason = parseStopReason(value['stopReason']);
  const devices = devicesValue.map(parseDevice);
  if (deliverable !== (stopReason === null && devices.length > 0)) {
    throw new MerchantAlertDeliveryDataInvalidError();
  }

  return {
    eventId: requireString(value, 'eventId'),
    alertId: requireString(value, 'alertId'),
    orderId: requireString(value, 'orderId'),
    orderNumber: requireString(value, 'orderNumber'),
    shopId: requireString(value, 'shopId'),
    shopName: requireString(value, 'shopName'),
    totalPaise: requireNonNegativeInteger(value, 'totalPaise'),
    expiresAt: requireTimestamp(value, 'expiresAt'),
    soundName: requireString(value, 'soundName'),
    eventAttemptNumber: requirePositiveInteger(value, 'eventAttemptNumber'),
    eventMaxAttempts: requirePositiveInteger(value, 'eventMaxAttempts'),
    deliverable,
    stopReason,
    devices,
  };
}

function parseCompletion(value: unknown): CompleteMerchantAlertDispatchResult {
  if (!isRecord(value)) throw new MerchantAlertDeliveryDataInvalidError();

  return {
    eventId: requireString(value, 'eventId'),
    alertId: requireString(value, 'alertId'),
    eventStatus: parseEventStatus(value['eventStatus']),
    alertStatus: parseAlertStatus(value['alertStatus']),
    successfulDevices: requireNonNegativeInteger(value, 'successfulDevices'),
    failedDevices: requireNonNegativeInteger(value, 'failedDevices'),
    retryAt: requireNullableTimestamp(value, 'retryAt'),
    stopped: requireBoolean(value, 'stopped'),
  };
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantAlertDeliveryGatewayUnavailableError ||
    error instanceof MerchantAlertDeliveryDataInvalidError
  ) {
    throw error;
  }
  throw new MerchantAlertDeliveryGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantAlertDeliveryGateway implements MerchantAlertDeliveryGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async claimDispatches(
    workerId: string,
    limit: number,
  ): Promise<readonly MerchantAlertDispatchClaim[]> {
    try {
      const response = await this.client.rpc('claim_merchant_alert_dispatches', {
        p_worker_id: workerId,
        p_limit: limit,
      });
      const data: unknown = response.data;
      if (response.error !== null || !Array.isArray(data)) {
        throw new MerchantAlertDeliveryGatewayUnavailableError();
      }
      const records: readonly unknown[] = data;
      return records.map(parseClaim);
    } catch (error: unknown) {
      rethrowGatewayError(error);
    }
  }

  public async completeDispatch(
    command: CompleteMerchantAlertDispatchCommand,
  ): Promise<CompleteMerchantAlertDispatchResult> {
    try {
      const response = await this.client.rpc('complete_merchant_alert_dispatch', {
        p_worker_id: command.workerId,
        p_event_id: command.eventId,
        p_alert_id: command.alertId,
        p_stop_reason: command.stopReason,
        p_results: command.results.map((result) => ({
          device_id: result.deviceId,
          outcome: result.outcome,
          provider_message_id: result.providerMessageId,
          failure_code: result.failureCode,
          failure_reason: result.failureReason,
          retryable: result.retryable,
        })),
      });
      if (response.error !== null) throw new MerchantAlertDeliveryGatewayUnavailableError();
      return parseCompletion(response.data);
    } catch (error: unknown) {
      rethrowGatewayError(error);
    }
  }
}
