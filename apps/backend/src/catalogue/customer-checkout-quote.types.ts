export interface CreateCustomerCheckoutQuoteInput {
  readonly addressId: string;
}

export interface CustomerCheckoutQuoteAddressSnapshot {
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

export interface CustomerCheckoutQuoteShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
}

export interface CustomerCheckoutQuoteItemSnapshot {
  readonly cartItemId: string;
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly sizeLabel: string | null;
  readonly quantity: number;
  readonly previousUnitPricePaise: number;
  readonly unitPricePaise: number;
  readonly priceChanged: boolean;
  readonly availableQuantity: number;
  readonly inventoryVersion: number;
  readonly lineTotalPaise: number;
}

export interface CustomerCheckoutQuoteTotalsSnapshot {
  readonly subtotalPaise: number;
  readonly productDiscountPaise: number;
  readonly couponDiscountPaise: number;
  readonly deliveryFeePaise: number;
  readonly platformFeePaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface CustomerCheckoutQuoteSnapshot {
  readonly id: string;
  readonly cartId: string;
  readonly address: CustomerCheckoutQuoteAddressSnapshot;
  readonly shop: CustomerCheckoutQuoteShopSnapshot;
  readonly items: readonly CustomerCheckoutQuoteItemSnapshot[];
  readonly totals: CustomerCheckoutQuoteTotalsSnapshot;
  readonly estimatedPreparationMinutes: number;
  readonly estimatedTravelMinutes: number;
  readonly estimatedDeliveryAt: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

interface CustomerCheckoutQuoteResponseMeta {
  readonly requestId: null;
}

export interface CustomerCheckoutQuoteResponse {
  readonly success: true;
  readonly data: {
    readonly quote: CustomerCheckoutQuoteSnapshot;
  };
  readonly meta: CustomerCheckoutQuoteResponseMeta;
}
