import type {
  MerchantAlertDeviceDestination,
  MerchantAlertDispatchClaim,
} from './merchant-alert-delivery.types';

export const MERCHANT_URGENT_ORDER_CHANNEL_ID = 'vastra_urgent_orders';

export interface MerchantAlertFcmRequest {
  readonly message: {
    readonly token: string;
    readonly notification: {
      readonly title: string;
      readonly body: string;
    };
    readonly data: Readonly<Record<string, string>>;
    readonly android: {
      readonly priority: 'high';
      readonly ttl: '60s';
      readonly notification: {
        readonly channel_id: string;
        readonly sound: string;
        readonly notification_priority: 'PRIORITY_MAX';
        readonly visibility: 'PRIVATE';
        readonly vibrate_timings: readonly string[];
      };
    };
  };
}

export function buildMerchantAlertFcmRequest(
  claim: MerchantAlertDispatchClaim,
  destination: MerchantAlertDeviceDestination,
): MerchantAlertFcmRequest {
  return {
    message: {
      token: destination.pushToken,
      notification: {
        title: 'New Vastra order',
        body: `Order ${claim.orderNumber} needs your response`,
      },
      data: {
        schemaVersion: '1',
        kind: 'MERCHANT_NEW_ORDER',
        alertId: claim.alertId,
        orderId: claim.orderId,
        orderNumber: claim.orderNumber,
        shopId: claim.shopId,
        expiresAt: claim.expiresAt,
        soundShouldPlay: 'true',
      },
      android: {
        priority: 'high',
        ttl: '60s',
        notification: {
          channel_id: MERCHANT_URGENT_ORDER_CHANNEL_ID,
          sound: claim.soundName,
          notification_priority: 'PRIORITY_MAX',
          visibility: 'PRIVATE',
          vibrate_timings: ['0s', '0.7s', '0.3s', '0.7s', '0.3s', '1s'],
        },
      },
    },
  };
}
