export interface PlaceCustomerCodOrderInput {
  readonly cartId: string;
  readonly quoteId: string;
  readonly addressId: string;
  readonly paymentMethod: 'COD';
  readonly customerNote: string | null;
  readonly idempotencyKey: string;
}

export interface CustomerOrderAddressSnapshot {
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

export interface CustomerOrderShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface CustomerOrderItemSnapshot {
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

export interface CustomerOrderTotalsSnapshot {
  readonly subtotalPaise: number;
  readonly productDiscountPaise: number;
  readonly couponDiscountPaise: number;
  readonly deliveryFeePaise: number;
  readonly platformFeePaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface CustomerCodOrderSnapshot {
  readonly id: string;
  readonly orderNumber: string;
  readonly cartId: string;
  readonly quoteId: string;
  readonly shop: CustomerOrderShopSnapshot;
  readonly address: CustomerOrderAddressSnapshot;
  readonly status: 'WAITING_FOR_MERCHANT';
  readonly paymentStatus: 'COD_PENDING';
  readonly paymentMethod: 'COD';
  readonly fulfilmentType: 'DELIVERY';
  readonly items: readonly CustomerOrderItemSnapshot[];
  readonly totals: CustomerOrderTotalsSnapshot;
  readonly estimatedDeliveryAt: string;
  readonly customerNote: string | null;
  readonly placedAt: string;
  readonly replayed: boolean;
}

export interface CustomerOrderResponse {
  readonly success: true;
  readonly data: {
    readonly order: CustomerCodOrderSnapshot;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
