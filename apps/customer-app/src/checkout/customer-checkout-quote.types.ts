export interface CreateCustomerCheckoutQuoteInput {
  readonly addressId: string;
}

export interface CustomerCheckoutQuoteAddress {
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

export interface CustomerCheckoutQuoteShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
}

export interface CustomerCheckoutQuoteItem {
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

export interface CustomerCheckoutQuoteTotals {
  readonly subtotalPaise: number;
  readonly productDiscountPaise: number;
  readonly couponDiscountPaise: number;
  readonly deliveryFeePaise: number;
  readonly platformFeePaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export interface CustomerCheckoutQuote {
  readonly id: string;
  readonly cartId: string;
  readonly address: CustomerCheckoutQuoteAddress;
  readonly shop: CustomerCheckoutQuoteShop;
  readonly items: readonly CustomerCheckoutQuoteItem[];
  readonly totals: CustomerCheckoutQuoteTotals;
  readonly estimatedPreparationMinutes: number;
  readonly estimatedTravelMinutes: number;
  readonly estimatedDeliveryAt: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface CustomerCheckoutQuotePort {
  createQuote(input: CreateCustomerCheckoutQuoteInput): Promise<CustomerCheckoutQuote>;
}

export type CustomerCheckoutQuoteFailureKind =
  | 'TRANSPORT'
  | 'AUTHENTICATION'
  | 'VALIDATION'
  | 'EMPTY_CART'
  | 'UNAVAILABLE_ITEM'
  | 'CHANGED_PRICE'
  | 'UNSERVICEABLE_ADDRESS'
  | 'STALE_QUOTE'
  | 'SHOP_UNAVAILABLE'
  | 'CONFLICT'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export class CustomerCheckoutQuoteError extends Error {
  public constructor(
    public readonly kind: CustomerCheckoutQuoteFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(`Customer checkout quote failed: ${kind}`);
    this.name = 'CustomerCheckoutQuoteError';
  }
}
