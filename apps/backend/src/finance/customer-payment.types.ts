export interface PlaceCustomerOnlineOrderInput {
  readonly cartId: string;
  readonly quoteId: string;
  readonly addressId: string;
  readonly customerNote: string | null;
  readonly idempotencyKey: string;
}

export interface PreparedCustomerPayment {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentId: string;
  readonly providerOrderId: string;
  readonly amountPaise: number;
  readonly currency: 'INR';
  readonly customerPhone: string;
  readonly paymentStatus: 'CREATED' | 'PENDING';
  readonly providerReferenceId: string | null;
  readonly paymentSessionId: string | null;
  readonly paymentSessionExpiresAt: string | null;
  readonly replayed: boolean;
}

export interface CustomerPaymentCheckout {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentId: string;
  readonly provider: 'cashfree';
  readonly providerOrderId: string;
  readonly providerReferenceId: string;
  readonly paymentSessionId: string;
  readonly amountPaise: number;
  readonly currency: 'INR';
  readonly paymentStatus: 'PENDING';
  readonly expiresAt: string | null;
  readonly replayed: boolean;
}

export interface CustomerPaymentResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: string | null };
}
