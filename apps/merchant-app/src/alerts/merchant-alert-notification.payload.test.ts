import { parseMerchantAlertNotificationPayload } from './merchant-alert-notification.payload';

const payload = {
  schemaVersion: '1',
  kind: 'MERCHANT_NEW_ORDER',
  alertId: '10000000-0000-4000-8000-000000000001',
  orderId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-20260717-001',
  shopId: '30000000-0000-4000-8000-000000000001',
  expiresAt: '2026-07-17T09:15:00.000Z',
  soundShouldPlay: 'true',
};

describe('parseMerchantAlertNotificationPayload', () => {
  it('accepts the frozen Sprint 7 payload', () => {
    expect(parseMerchantAlertNotificationPayload(payload, 'notification-1')).toEqual({
      ...payload,
      soundShouldPlay: true,
      notificationId: 'notification-1',
    });
  });

  it('ignores unrelated notifications', () => {
    expect(parseMerchantAlertNotificationPayload({ kind: 'OTHER' })).toBeNull();
  });

  it('rejects malformed identifiers', () => {
    expect(() =>
      parseMerchantAlertNotificationPayload({ ...payload, alertId: 'not-a-uuid' }),
    ).toThrow('Invalid merchant alert UUID');
  });
});
