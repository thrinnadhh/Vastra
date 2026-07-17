import type { MerchantAlertNotificationPayload } from './merchant-alert-notification.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`Invalid merchant alert field: ${key}`);
  }
  return value;
}

function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!UUID_PATTERN.test(value)) throw new TypeError(`Invalid merchant alert UUID: ${key}`);
  return value;
}

export function parseMerchantAlertNotificationPayload(
  value: unknown,
  notificationId: string | null = null,
): MerchantAlertNotificationPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (
    record['schemaVersion'] !== '1' ||
    record['kind'] !== 'MERCHANT_NEW_ORDER' ||
    record['soundShouldPlay'] !== 'true'
  ) {
    return null;
  }

  const expiresAt = readString(record, 'expiresAt');
  if (Number.isNaN(Date.parse(expiresAt))) throw new TypeError('Invalid merchant alert expiry');

  return {
    schemaVersion: '1',
    kind: 'MERCHANT_NEW_ORDER',
    alertId: readUuid(record, 'alertId'),
    orderId: readUuid(record, 'orderId'),
    orderNumber: readString(record, 'orderNumber'),
    shopId: readUuid(record, 'shopId'),
    expiresAt,
    soundShouldPlay: true,
    notificationId,
  };
}
