import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  MerchantAlertDeliveryActivity,
  MerchantAlertDeliveryMetrics,
  MerchantAlertObservabilityGateway,
} from './merchant-alert-observability.types';

export class MerchantAlertObservabilityUnavailableError extends Error {}
export class MerchantAlertObservabilityDataInvalidError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantAlertObservabilityDataInvalidError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new MerchantAlertObservabilityDataInvalidError();
  return value;
}

function integerValue(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantAlertObservabilityDataInvalidError();
  }
  return value;
}

function timestampValue(record: Record<string, unknown>, key: string): string {
  const value = stringValue(record, key);
  if (Number.isNaN(Date.parse(value))) throw new MerchantAlertObservabilityDataInvalidError();
  return value;
}

function nullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = nullableString(record, key);
  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new MerchantAlertObservabilityDataInvalidError();
  }
  return value;
}

function parseMetrics(value: unknown): MerchantAlertDeliveryMetrics {
  if (!isRecord(value)) throw new MerchantAlertObservabilityDataInvalidError();
  return {
    windowMinutes: integerValue(value, 'windowMinutes'),
    generatedAt: timestampValue(value, 'generatedAt'),
    alertsCreated: integerValue(value, 'alertsCreated'),
    alertsSent: integerValue(value, 'alertsSent'),
    alertsAcknowledged: integerValue(value, 'alertsAcknowledged'),
    alertsExpired: integerValue(value, 'alertsExpired'),
    alertsFailed: integerValue(value, 'alertsFailed'),
    averageAcknowledgementSeconds: integerValue(value, 'averageAcknowledgementSeconds'),
    activeAlerts: integerValue(value, 'activeAlerts'),
    remindersQueued: integerValue(value, 'remindersQueued'),
    deliveryAttempts: integerValue(value, 'deliveryAttempts'),
    successfulAttempts: integerValue(value, 'successfulAttempts'),
    failedAttempts: integerValue(value, 'failedAttempts'),
    retryableFailures: integerValue(value, 'retryableFailures'),
    unregisteredTokens: integerValue(value, 'unregisteredTokens'),
    outboxBacklog: integerValue(value, 'outboxBacklog'),
  };
}

function parseActivity(value: unknown): MerchantAlertDeliveryActivity {
  if (!isRecord(value)) throw new MerchantAlertObservabilityDataInvalidError();
  return {
    alertId: stringValue(value, 'alertId'),
    orderId: stringValue(value, 'orderId'),
    orderNumber: stringValue(value, 'orderNumber'),
    shopId: stringValue(value, 'shopId'),
    shopName: stringValue(value, 'shopName'),
    alertStatus: stringValue(value, 'alertStatus'),
    attemptCount: integerValue(value, 'attemptCount'),
    reminderCount: integerValue(value, 'reminderCount'),
    createdAt: timestampValue(value, 'createdAt'),
    expiresAt: timestampValue(value, 'expiresAt'),
    acknowledgedAt: nullableTimestamp(value, 'acknowledgedAt'),
    expiredAt: nullableTimestamp(value, 'expiredAt'),
    failureReason: nullableString(value, 'failureReason'),
    successfulDeviceAttempts: integerValue(value, 'successfulDeviceAttempts'),
    failedDeviceAttempts: integerValue(value, 'failedDeviceAttempts'),
    retryableDeviceFailures: integerValue(value, 'retryableDeviceFailures'),
    lastAttemptAt: nullableTimestamp(value, 'lastAttemptAt'),
    lastFailureCode: nullableString(value, 'lastFailureCode'),
  };
}

@Injectable()
export class SupabaseMerchantAlertObservabilityGateway implements MerchantAlertObservabilityGateway {
  public constructor(@Inject(SUPABASE_SERVICE_CLIENT) private readonly client: SupabaseClient) {}

  public async getMetrics(windowMinutes: number): Promise<MerchantAlertDeliveryMetrics> {
    try {
      const response = await this.client.rpc('get_merchant_alert_delivery_metrics', {
        p_window_minutes: windowMinutes,
      });
      if (response.error !== null) throw new MerchantAlertObservabilityUnavailableError();
      return parseMetrics(response.data);
    } catch (error: unknown) {
      if (
        error instanceof MerchantAlertObservabilityUnavailableError ||
        error instanceof MerchantAlertObservabilityDataInvalidError
      ) {
        throw error;
      }
      throw new MerchantAlertObservabilityUnavailableError();
    }
  }

  public async listActivity(
    limit: number,
    before: string | null,
  ): Promise<readonly MerchantAlertDeliveryActivity[]> {
    try {
      const response = await this.client.rpc('list_merchant_alert_delivery_activity', {
        p_limit: limit,
        p_before: before,
      });
      const data: unknown = response.data;
      if (response.error !== null || !Array.isArray(data)) {
        throw new MerchantAlertObservabilityUnavailableError();
      }
      const rows: readonly unknown[] = data;
      return rows.map(parseActivity);
    } catch (error: unknown) {
      if (
        error instanceof MerchantAlertObservabilityUnavailableError ||
        error instanceof MerchantAlertObservabilityDataInvalidError
      ) {
        throw error;
      }
      throw new MerchantAlertObservabilityUnavailableError();
    }
  }
}
