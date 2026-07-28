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

export interface CustomerOrderBranchSnapshot {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: 'PHYSICAL_STORE' | 'CLOUD_SHOP';
  readonly addressId: string;
  readonly returnAddressId: string;
  readonly pincode: string | null;
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerOrderGeographySnapshot {
  readonly cityId: string;
  readonly cityCode: string;
  readonly cityName: string;
  readonly serviceZoneId: string;
  readonly serviceZoneCode: string;
  readonly serviceZoneName: string;
  readonly customerPincode: string;
  readonly fulfilmentMode: 'LOCAL_DELIVERY';
  readonly distanceMeters: number;
  readonly deliveryRadiusMeters: number;
}

export interface CustomerOrderCommercialSnapshot {
  readonly deliveryFeePaise: number;
  readonly codEligible: boolean;
  readonly codLimitPaise: number;
  readonly merchantCommissionBps: number;
  readonly cityConfigurationVersion: number;
  readonly cancellationPolicy: Readonly<Record<string, unknown>>;
  readonly refundPolicy: Readonly<Record<string, unknown>>;
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
  readonly branchInventoryVersion?: number | null;
  readonly branchInventoryReservationId?: string | null;
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
  readonly contractVersion: 2;
  readonly shop: CustomerOrderShopSnapshot;
  readonly branch: CustomerOrderBranchSnapshot;
  readonly geography: CustomerOrderGeographySnapshot;
  readonly commercial: CustomerOrderCommercialSnapshot;
  readonly address: CustomerOrderAddressSnapshot;
  readonly status: 'WAITING_FOR_MERCHANT';
  readonly paymentStatus: 'COD_PENDING';
  readonly paymentMethod: 'COD';
  readonly fulfilmentType: 'DELIVERY';
  readonly fulfilmentMode: 'LOCAL_DELIVERY';
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
