import type { CustomerOrderPaymentStatus } from './customer-order-read.types';

export interface CustomerOrderCancellationInput {
  readonly orderId: string;
  readonly idempotencyKey: string;
}

export interface CustomerOrderCancellationResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: 'CANCELLED';
  readonly paymentStatus: CustomerOrderPaymentStatus;
  readonly refundId: string | null;
  readonly refundStatus: 'INITIATED' | null;
  readonly reservationsReleased: number;
  readonly cancelledAt: string;
  readonly replayed: boolean;
}

export interface CustomerOrderCancellationResponse {
  readonly success: true;
  readonly data: {
    readonly cancellation: CustomerOrderCancellationResult;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
