import { describe, expect, it } from 'vitest';

import type { MerchantAlertDispatchClaim } from './merchant-alert-delivery.types';
import {
  buildMerchantAlertFcmRequest,
  MERCHANT_URGENT_ORDER_CHANNEL_ID,
} from './merchant-alert-fcm-payload';

const CLAIM: MerchantAlertDispatchClaim = {
  eventId: '10000000-0000-4000-8000-000000000001',
  alertId: '20000000-0000-4000-8000-000000000001',
  orderId: '30000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-7001',
  shopId: '40000000-0000-4000-8000-000000000001',
  shopName: 'Alert Shop',
  totalPaise: 54_500,
  expiresAt: '2026-07-17T06:30:00.000Z',
  soundName: 'vastra_new_order',
  eventAttemptNumber: 1,
  eventMaxAttempts: 12,
  deliverable: true,
  stopReason: null,
  devices: [
    {
      deviceId: '50000000-0000-4000-8000-000000000001',
      pushToken: 'fcm-token-one',
    },
  ],
};

describe('buildMerchantAlertFcmRequest', () => {
  it('creates a private, high-priority Android order alert', () => {
    const request = buildMerchantAlertFcmRequest(CLAIM, CLAIM.devices[0]!);

    expect(request.message.android.priority).toBe('high');
    expect(request.message.android.notification.channel_id).toBe(MERCHANT_URGENT_ORDER_CHANNEL_ID);
    expect(request.message.android.notification.sound).toBe('vastra_new_order');
    expect(request.message.android.notification.notification_priority).toBe('PRIORITY_MAX');
    expect(request.message.android.notification.visibility).toBe('PRIVATE');
    expect(request.message.data).toEqual({
      schemaVersion: '1',
      kind: 'MERCHANT_NEW_ORDER',
      alertId: CLAIM.alertId,
      orderId: CLAIM.orderId,
      orderNumber: CLAIM.orderNumber,
      shopId: CLAIM.shopId,
      expiresAt: CLAIM.expiresAt,
      soundShouldPlay: 'true',
    });
  });

  it('does not put merchant credentials or customer contact data in the payload', () => {
    const serialized = JSON.stringify(buildMerchantAlertFcmRequest(CLAIM, CLAIM.devices[0]!));

    expect(serialized).not.toContain('private_key');
    expect(serialized).not.toContain('client_email');
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('address');
  });
});
