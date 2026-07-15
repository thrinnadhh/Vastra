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
export interface MerchantAcceptOrderInput {
  readonly preparationMinutes: number;
}
export interface MerchantRejectOrderInput {
  readonly reasonCode: MerchantRejectionReason;
  readonly orderItemId: string | null;
  readonly note: string | null;
}
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
export interface MerchantOrderDecisionResponse {
  readonly success: true;
  readonly data: { readonly order: MerchantOrderDecisionResult };
  readonly meta: { readonly requestId: null };
}
