export const MERCHANT_DELIVERY_TASK_STATUSES = [
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

export type MerchantDeliveryTaskStatus = (typeof MERCHANT_DELIVERY_TASK_STATUSES)[number];

export interface MerchantDeliveryProjection {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly taskStatus: MerchantDeliveryTaskStatus;
  readonly captainAssigned: boolean;
  readonly captainAtStore: boolean;
  readonly pickedUpAt: string | null;
  readonly updatedAt: string;
}

export interface MerchantPickupCode {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly secret: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export type MerchantHandoverFailureKind =
  | 'TRANSPORT'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export class MerchantHandoverError extends Error {
  public constructor(
    public readonly kind: MerchantHandoverFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(`Merchant handover request failed: ${kind}`);
    this.name = 'MerchantHandoverError';
  }
}

export interface MerchantOrderHandoverPort {
  getDelivery(orderId: string): Promise<MerchantDeliveryProjection>;
  getPickupCode(orderId: string): Promise<MerchantPickupCode>;
}
