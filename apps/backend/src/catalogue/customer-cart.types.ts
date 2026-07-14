import type { ShopOperationalStatus } from './merchant-shop-context.types';

export interface CustomerCartShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoObjectKey: string | null;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
}

export interface CustomerCartItemSnapshot {
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

export interface CustomerCartSnapshot {
  readonly id: string;
  readonly shop: CustomerCartShopSnapshot;
  readonly items: readonly CustomerCartItemSnapshot[];
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
  readonly replaceExistingCart: boolean;
}

export interface UpdateCustomerCartItemInput {
  readonly quantity: number;
}

interface CustomerCartResponseMeta {
  readonly requestId: null;
}

export interface CustomerCartResponse {
  readonly success: true;
  readonly data: {
    readonly cart: CustomerCartSnapshot | null;
  };
  readonly meta: CustomerCartResponseMeta;
}
