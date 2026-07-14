import type {
  CustomerOrderAddressSnapshot,
  CustomerOrderItemSnapshot,
  CustomerOrderShopSnapshot,
  CustomerOrderTotalsSnapshot,
} from './customer-order.types';

export const CUSTOMER_ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'WAITING_FOR_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CAPTAIN_SEARCHING',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'CAPTAIN_AT_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
  'PROBLEM_REPORTED',
  'CANCELLED',
] as const;

export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

export const CUSTOMER_ORDER_PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_PENDING',
  'COD_COLLECTED',
] as const;

export type CustomerOrderPaymentStatus = (typeof CUSTOMER_ORDER_PAYMENT_STATUSES)[number];

export const CUSTOMER_ORDER_FULFILMENT_TYPES = ['DELIVERY', 'CUSTOMER_PICKUP'] as const;

export type CustomerOrderFulfilmentType = (typeof CUSTOMER_ORDER_FULFILMENT_TYPES)[number];

export const CUSTOMER_ORDER_ACTOR_ROLES = [
  'SYSTEM',
  'CUSTOMER',
  'MERCHANT',
  'CAPTAIN',
  'ADMIN',
] as const;

export type CustomerOrderActorRole = (typeof CUSTOMER_ORDER_ACTOR_ROLES)[number];

export interface CustomerOrderListQuery {
  readonly offset: number;
  readonly limit: number;
}

export interface CustomerOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly shop: CustomerOrderShopSnapshot;
  readonly status: CustomerOrderStatus;
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly fulfilmentType: CustomerOrderFulfilmentType;
  readonly itemCount: number;
  readonly previewImageObjectKey: string | null;
  readonly totals: CustomerOrderTotalsSnapshot;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string | null;
  readonly createdAt: string;
}

export interface CustomerOrderListPage {
  readonly orders: readonly CustomerOrderSummary[];
  readonly nextOffset: number | null;
}

export interface CustomerOrderHistoryEntry {
  readonly id: string;
  readonly previousStatus: CustomerOrderStatus | null;
  readonly newStatus: CustomerOrderStatus;
  readonly changedByRole: CustomerOrderActorRole;
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CustomerOrderDetail {
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

interface CustomerOrderReadResponseMeta {
  readonly requestId: null;
}

export interface ListCustomerOrdersResponse {
  readonly success: true;
  readonly data: {
    readonly orders: readonly CustomerOrderSummary[];
    readonly nextCursor: string | null;
  };
  readonly meta: CustomerOrderReadResponseMeta;
}

export interface GetCustomerOrderResponse {
  readonly success: true;
  readonly data: {
    readonly order: CustomerOrderDetail;
  };
  readonly meta: CustomerOrderReadResponseMeta;
}
