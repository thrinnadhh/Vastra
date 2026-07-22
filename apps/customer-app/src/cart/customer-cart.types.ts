export interface CustomerCartShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoObjectKey: string | null;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
}

export interface CustomerCartItem {
  readonly id: string;
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly productSlug: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly sizeLabel: string | null;
  readonly imageObjectKey: string | null;
  readonly quantity: number;
  readonly unitPricePaise: number;
  readonly currentUnitPricePaise: number;
  readonly priceChanged: boolean;
  readonly availableQuantity: number;
  readonly isAvailable: boolean;
  readonly lineTotalPaise: number;
  readonly currentLineTotalPaise: number;
  readonly addedAt: string;
  readonly updatedAt: string;
}

export interface CustomerCart {
  readonly id: string;
  readonly shop: CustomerCartShop;
  readonly items: readonly CustomerCartItem[];
  readonly itemCount: number;
  readonly subtotalPaise: number;
  readonly currentSubtotalPaise: number;
  readonly hasPriceChanges: boolean;
  readonly hasUnavailableItems: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SetCustomerCartItemInput {
  readonly variantId: string;
  readonly quantity: number;
  readonly replaceExistingCart?: boolean;
}

export interface CustomerCartPort {
  getCart(): Promise<CustomerCart | null>;
  setItem(input: SetCustomerCartItemInput): Promise<CustomerCart | null>;
  updateItem(cartItemId: string, quantity: number): Promise<CustomerCart | null>;
  removeItem(cartItemId: string): Promise<CustomerCart | null>;
  clearCart(): Promise<CustomerCart | null>;
}

export type CustomerCartFailureKind =
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'TRANSPORT'
  | 'TIMEOUT'
  | 'SHOP_CONFLICT'
  | 'PRICE_CONFLICT'
  | 'INVENTORY_CONFLICT'
  | 'UNAVAILABLE_ITEM'
  | 'NOT_FOUND'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export class CustomerCartError extends Error {
  public constructor(
    public readonly kind: CustomerCartFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(`Customer cart request failed: ${kind}`);
    this.name = 'CustomerCartError';
  }
}
