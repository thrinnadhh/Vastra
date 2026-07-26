export interface AdminDashboardSummary {
  readonly openOrders: number;
  readonly interventionOrders: number;
  readonly searchingDeliveries: number;
  readonly activeDeliveries: number;
  readonly openCases: number;
  readonly suspendedMerchants: number;
  readonly suspendedCaptains: number;
  readonly generatedAt: string;
}

export const ADMIN_SEARCH_RESULT_TYPES = [
  'ORDER',
  'DELIVERY_TASK',
  'MERCHANT',
  'CAPTAIN',
  'CASE',
] as const;

export type AdminSearchResultType = (typeof ADMIN_SEARCH_RESULT_TYPES)[number];

export interface AdminSearchResult {
  readonly type: AdminSearchResultType;
  readonly id: string;
  readonly primaryText: string;
  readonly secondaryText: string;
  readonly status: string;
  readonly updatedAt: string;
}

export const ADMIN_ORDER_STATUSES = [
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

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export const ADMIN_ORDER_ISSUES = [
  'DELAYED',
  'UNASSIGNED',
  'MERCHANT_TIMEOUT',
  'CAPTAIN_ISSUE',
  'PAYMENT_ISSUE',
] as const;

export type AdminOrderIssue = (typeof ADMIN_ORDER_ISSUES)[number];

export interface AdminOperationalOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: AdminOrderStatus;
  readonly paymentStatus: string;
  readonly fulfilmentType: string;
  readonly totalPaise: number;
  readonly itemCount: number;
  readonly customer: {
    readonly id: string;
    readonly name: string | null;
    readonly phoneNumber: string | null;
  };
  readonly shop: {
    readonly id: string;
    readonly name: string;
    readonly merchantId: string;
  };
  readonly deliveryTaskId: string | null;
  readonly deliveryStatus: string | null;
  readonly interventionReason: AdminOrderIssue | null;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminOrderCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface AdminOrderListPage {
  readonly orders: readonly AdminOperationalOrder[];
  readonly nextCursor: AdminOrderCursor | null;
}

export interface AdminOrderListResponse {
  readonly orders: readonly AdminOperationalOrder[];
  readonly nextCursor: string | null;
}
