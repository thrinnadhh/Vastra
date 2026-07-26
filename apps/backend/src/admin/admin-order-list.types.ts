import type { AdminListCursor } from './admin-list.validation';

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

export const ADMIN_ORDER_PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_PENDING',
  'COD_COLLECTED',
] as const;

export const ADMIN_ORDER_FULFILMENT_TYPES = ['DELIVERY', 'CUSTOMER_PICKUP'] as const;
export const ADMIN_DELIVERY_TASK_STATUSES = [
  'CREATED',
  'SEARCHING',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROP',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export const ADMIN_OPERATIONAL_RESULT_QUEUES = [
  'WAITING',
  'STUCK',
  'UNASSIGNED',
  'ACTIVE',
  'ALERT',
  'PAYMENT',
  'REFUND',
  'CASE',
  'PROBLEM',
] as const;

export const ADMIN_OPERATIONAL_QUEUES = ['ALL', ...ADMIN_OPERATIONAL_RESULT_QUEUES] as const;

export type AdminOperationalQueue = (typeof ADMIN_OPERATIONAL_QUEUES)[number];

export interface AdminOperationalOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly orderStatus: (typeof ADMIN_ORDER_STATUSES)[number];
  readonly paymentStatus: (typeof ADMIN_ORDER_PAYMENT_STATUSES)[number];
  readonly fulfilmentType: (typeof ADMIN_ORDER_FULFILMENT_TYPES)[number];
  readonly totalPaise: number;
  readonly operationalQueue: (typeof ADMIN_OPERATIONAL_RESULT_QUEUES)[number];
  readonly shop: {
    readonly id: string;
    readonly name: string;
  };
  readonly customer: {
    readonly id: string;
    readonly displayName: string;
    readonly phoneLast4: string | null;
  };
  readonly delivery: {
    readonly taskId: string;
    readonly status: (typeof ADMIN_DELIVERY_TASK_STATUSES)[number];
    readonly assignedCaptainId: string | null;
    readonly updatedAt: string;
  } | null;
  readonly attention: {
    readonly alert: boolean;
    readonly payment: boolean;
    readonly refund: boolean;
    readonly case: boolean;
  };
  readonly updatedAt: string;
}

export interface AdminOperationalOrderQuery {
  readonly queue: AdminOperationalQueue | null;
  readonly status: (typeof ADMIN_ORDER_STATUSES)[number] | null;
  readonly shopId: string | null;
  readonly cursor: AdminListCursor | null;
  readonly limit: number;
}

export interface AdminOperationalOrderPage {
  readonly items: readonly AdminOperationalOrder[];
  readonly nextCursor: AdminListCursor | null;
}

export interface ListAdminOperationalOrdersResponse {
  readonly success: true;
  readonly data: {
    readonly orders: readonly AdminOperationalOrder[];
    readonly nextCursor: string | null;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
