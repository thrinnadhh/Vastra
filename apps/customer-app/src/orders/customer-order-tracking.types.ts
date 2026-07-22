import type { CustomerOrderError } from './customer-order.types';

export interface CustomerOrderTrackingSnapshot {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly taskStatus: string;
  readonly captain: {
    readonly displayName: string | null;
    readonly phoneLast4: string | null;
    readonly vehicleType: string | null;
    readonly vehicleNumberLast4: string | null;
  } | null;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly recordedAt: string;
    readonly stale: boolean;
  } | null;
  readonly estimatedArrivalAt: string | null;
  readonly updatedAt: string;
}

export interface CustomerDeliveryOtp {
  readonly secret: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface CustomerOrderTrackingPort {
  getTracking(orderId: string): Promise<CustomerOrderTrackingSnapshot>;
  getDeliveryOtp(orderId: string): Promise<CustomerDeliveryOtp>;
}

export interface CustomerOrderTrackingFailure {
  readonly error: CustomerOrderError;
}
