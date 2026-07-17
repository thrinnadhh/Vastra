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

export interface CustomerOrderAddress {
  readonly id: string;
  readonly label: string | null;
  readonly recipientName: string;
  readonly phoneNumber: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly landmark: string | null;
  readonly area: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerOrderShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface CustomerOrderItem {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly productName: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly sizeLabel: string | null;
  readonly imageObjectKey: string | null;
  readonly quantity: number;
  readonly unitMrpPaise: number;
  readonly unitSellingPricePaise: number;
  readonly discountPaise: number;
  readonly totalPaise: number;
}

export interface CustomerOrderTotals {
  readonly subtotalPaise: number;
  readonly productDiscountPaise: number;
  readonly couponDiscountPaise: number;
  readonly deliveryFeePaise: number;
  readonly platformFeePaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface PlacedCustomerCodOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly cartId: string;
  readonly quoteId: string;
  readonly shop: CustomerOrderShop;
  readonly address: CustomerOrderAddress;
  readonly status: 'WAITING_FOR_MERCHANT';
  readonly paymentStatus: 'COD_PENDING';
  readonly paymentMethod: 'COD';
  readonly fulfilmentType: 'DELIVERY';
  readonly items: readonly CustomerOrderItem[];
  readonly totals: CustomerOrderTotals;
  readonly estimatedDeliveryAt: string;
  readonly customerNote: string | null;
  readonly placedAt: string;
  readonly replayed: boolean;
}

export interface PlaceCustomerCodOrderInput {
  readonly cartId: string;
  readonly quoteId: string;
  readonly addressId: string;
  readonly customerNote?: string | null;
  readonly idempotencyKey: string;
}

export interface CustomerOrderPlacementPort {
  placeCodOrder(input: PlaceCustomerCodOrderInput): Promise<PlacedCustomerCodOrder>;
}

export type CustomerOrderPaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'COD_PENDING'
  | 'COD_COLLECTED';

export type CustomerOrderFulfilmentType = 'DELIVERY' | 'CUSTOMER_PICKUP';

export interface CustomerOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly shop: CustomerOrderShop;
  readonly status: CustomerOrderStatus;
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly fulfilmentType: CustomerOrderFulfilmentType;
  readonly itemCount: number;
  readonly previewImageObjectKey: string | null;
  readonly totals: CustomerOrderTotals;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string | null;
  readonly createdAt: string;
}

export interface CustomerOrdersPage {
  readonly orders: readonly CustomerOrderSummary[];
  readonly nextCursor: string | null;
}

export interface ListCustomerOrdersInput {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CustomerOrdersListPort {
  listOrders(input?: ListCustomerOrdersInput): Promise<CustomerOrdersPage>;
}

export type CustomerOrderHistoryActorRole =
  'SYSTEM' | 'CUSTOMER' | 'MERCHANT' | 'CAPTAIN' | 'ADMIN';

export interface CustomerOrderHistoryEntry {
  readonly id: string;
  readonly previousStatus: CustomerOrderStatus | null;
  readonly newStatus: CustomerOrderStatus;
  readonly changedByRole: CustomerOrderHistoryActorRole;
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CustomerOrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly cartId: string | null;
  readonly quoteId: string | null;
  readonly shop: CustomerOrderShop;
  readonly address: CustomerOrderAddress;
  readonly status: CustomerOrderStatus;
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly fulfilmentType: CustomerOrderFulfilmentType;
  readonly items: readonly CustomerOrderItem[];
  readonly itemCount: number;
  readonly totals: CustomerOrderTotals;
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

export interface CustomerOrderDetailPort {
  getOrder(orderId: string): Promise<CustomerOrderDetail>;
}

export interface CustomerOrderReadPort extends CustomerOrdersListPort, CustomerOrderDetailPort {}

export type CustomerOrderFailureKind =
  | 'TRANSPORT'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'STALE_QUOTE'
  | 'CONFLICT'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class CustomerOrderError extends Error {
  public constructor(
    public readonly kind: CustomerOrderFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(`Customer order request failed: ${kind}`);
    this.name = 'CustomerOrderError';
  }
}
