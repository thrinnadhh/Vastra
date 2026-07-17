export const MERCHANT_ORDER_STATUSES = [
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

export type MerchantOrderStatus = (typeof MERCHANT_ORDER_STATUSES)[number];

export type MerchantOrderGroup =
  'New' | 'Accepted' | 'Packing' | 'Ready' | 'Completed' | 'Rejected';

export interface MerchantOrderShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface MerchantOrderTotals {
  readonly subtotalPaise: number;
  readonly productDiscountPaise: number;
  readonly couponDiscountPaise: number;
  readonly deliveryFeePaise: number;
  readonly platformFeePaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface MerchantOrderAlert {
  readonly id: string;
  readonly status: 'PENDING' | 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED' | 'EXPIRED' | 'FAILED';
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
  readonly shop: MerchantOrderShop;
  readonly customerName: string;
  readonly status: MerchantOrderStatus;
  readonly paymentStatus: string;
  readonly fulfilmentType: string;
  readonly itemCount: number;
  readonly previewImageObjectKey: string | null;
  readonly totals: MerchantOrderTotals;
  readonly alert: MerchantOrderAlert | null;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string | null;
  readonly createdAt: string;
}

export interface MerchantOrderAddress {
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

export interface MerchantOrderItem {
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

export interface MerchantOrderHistoryEntry {
  readonly id: string;
  readonly previousStatus: MerchantOrderStatus | null;
  readonly newStatus: MerchantOrderStatus;
  readonly changedByRole: 'SYSTEM' | 'CUSTOMER' | 'MERCHANT' | 'CAPTAIN' | 'ADMIN';
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface MerchantOrderDetail extends Omit<MerchantOrderSummary, 'customerName'> {
  readonly cartId: string | null;
  readonly quoteId: string | null;
  readonly address: MerchantOrderAddress;
  readonly items: readonly MerchantOrderItem[];
  readonly customerNote: string | null;
  readonly cancellationReasonCode: string | null;
  readonly cancellationNote: string | null;
  readonly history: readonly MerchantOrderHistoryEntry[];
  readonly acceptedAt: string | null;
  readonly readyAt: string | null;
  readonly pickedUpAt: string | null;
  readonly deliveredAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly updatedAt: string;
}

export interface MerchantOrderPage {
  readonly orders: readonly MerchantOrderSummary[];
  readonly nextCursor: string | null;
}

export interface MerchantOrderReadPort {
  listOrders(input: {
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<MerchantOrderPage>;
  getOrder(orderId: string): Promise<MerchantOrderDetail>;
}

export const MERCHANT_REJECTION_REASONS = [
  'OUT_OF_STOCK',
  'SIZE_UNAVAILABLE',
  'COLOUR_UNAVAILABLE',
  'DAMAGED_ITEM',
  'INVENTORY_MISMATCH',
  'ITEM_NOT_FOUND',
  'SHOP_BUSY',
  'SHOP_CLOSING',
  'OTHER',
] as const;

export type MerchantRejectionReason = (typeof MERCHANT_REJECTION_REASONS)[number];

export interface MerchantOrderDecisionResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: 'MERCHANT_ACCEPTED' | 'CANCELLED';
  readonly alertStatus: 'ACKNOWLEDGED';
  readonly merchantPreparationMinutes: number | null;
  readonly acceptedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReasonCode: string | null;
  readonly cancellationNote: string | null;
  readonly reservationsReleased: number;
  readonly replayed: boolean;
}

export interface MerchantOrderDecisionPort {
  acceptOrder(
    orderId: string,
    input: { readonly preparationMinutes: number },
  ): Promise<MerchantOrderDecisionResult>;
  rejectOrder(
    orderId: string,
    input: {
      readonly reasonCode: MerchantRejectionReason;
      readonly orderItemId: string | null;
      readonly note: string | null;
    },
  ): Promise<MerchantOrderDecisionResult>;
}

export type MerchantOrderFailureKind =
  | 'TRANSPORT'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'VALIDATION'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export class MerchantOrderError extends Error {
  public constructor(
    public readonly kind: MerchantOrderFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(`Merchant order request failed: ${kind}`);
    this.name = 'MerchantOrderError';
  }
}

export function groupMerchantOrderStatus(status: MerchantOrderStatus): MerchantOrderGroup {
  switch (status) {
    case 'PAYMENT_PENDING':
    case 'WAITING_FOR_MERCHANT':
      return 'New';
    case 'MERCHANT_ACCEPTED':
      return 'Accepted';
    case 'PACKING':
      return 'Packing';
    case 'READY_FOR_PICKUP':
    case 'CAPTAIN_SEARCHING':
    case 'CAPTAIN_ASSIGNED':
    case 'CAPTAIN_AT_STORE':
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
    case 'CAPTAIN_AT_CUSTOMER':
      return 'Ready';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Completed';
    case 'PROBLEM_REPORTED':
    case 'CANCELLED':
      return 'Rejected';
  }
}
