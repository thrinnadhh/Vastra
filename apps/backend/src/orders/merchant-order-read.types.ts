import type {
  CustomerOrderAddressSnapshot,
  CustomerOrderItemSnapshot,
  CustomerOrderShopSnapshot,
  CustomerOrderTotalsSnapshot,
} from './customer-order.types';
import type {
  CustomerOrderFulfilmentType,
  CustomerOrderHistoryEntry,
  CustomerOrderPaymentStatus,
  CustomerOrderStatus,
} from './customer-order-read.types';

export const MERCHANT_ORDER_ALERT_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'EXPIRED',
  'FAILED',
] as const;

export type MerchantOrderAlertStatus = (typeof MERCHANT_ORDER_ALERT_STATUSES)[number];

export interface MerchantOrderListQuery {
  readonly offset: number;
  readonly limit: number;
}

export interface MerchantOrderAlertSnapshot {
  readonly id: string;
  readonly status: MerchantOrderAlertStatus;
  readonly attemptCount: number;
  readonly firstSentAt: string | null;
  readonly lastSentAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly expiresAt: string;
  readonly soundName: string;
  readonly failureReason: string | null;
  readonly createdAt: string;
}

export interface MerchantOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly shop: CustomerOrderShopSnapshot;
  readonly customerName: string;
  readonly status: CustomerOrderStatus;
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly fulfilmentType: CustomerOrderFulfilmentType;
  readonly itemCount: number;
  readonly previewImageObjectKey: string | null;
  readonly totals: CustomerOrderTotalsSnapshot;
  readonly alert: MerchantOrderAlertSnapshot | null;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string | null;
  readonly createdAt: string;
}

export interface MerchantOrderListPage {
  readonly orders: readonly MerchantOrderSummary[];
  readonly nextOffset: number | null;
}

export interface MerchantOrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly cartId: string | null;
  readonly quoteId: string | null;
  readonly shop: CustomerOrderShopSnapshot;
  readonly address: CustomerOrderAddressSnapshot;
  readonly status: CustomerOrderStatus;
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly fulfilmentType: CustomerOrderFulfilmentType;
  readonly items: readonly CustomerOrderItemSnapshot[];
  readonly itemCount: number;
  readonly totals: CustomerOrderTotalsSnapshot;
  readonly alert: MerchantOrderAlertSnapshot | null;
  readonly estimatedDeliveryAt: string | null;
  readonly customerNote: string | null;
  readonly cancellationReasonCode: string | null;
  readonly cancellationNote: string | null;
  readonly history: readonly CustomerOrderHistoryEntry[];
  readonly placedAt: string | null;
  readonly acceptedAt: string | null;
  readonly readyAt: string | null;
  readonly pickedUpAt: string | null;
  readonly deliveredAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface MerchantOrderReadResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantOrdersResponse {
  readonly success: true;
  readonly data: {
    readonly orders: readonly MerchantOrderSummary[];
    readonly nextCursor: string | null;
  };
  readonly meta: MerchantOrderReadResponseMeta;
}

export interface GetMerchantOrderResponse {
  readonly success: true;
  readonly data: {
    readonly order: MerchantOrderDetail;
  };
  readonly meta: MerchantOrderReadResponseMeta;
}
