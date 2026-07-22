export type CustomerProductFailureKind =
  | 'OFFLINE'
  | 'NOT_FOUND'
  | 'CART_CONFLICT'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface CustomerProductImage {
  readonly id: string;
  readonly imageType: string;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
  readonly imageUrl: string;
  readonly thumbnailUrl: string | null;
}

export interface CustomerProductVariant {
  readonly id: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly colourHex: string | null;
  readonly sizeLabel: string | null;
  readonly mrpPaise: number;
  readonly sellingPricePaise: number;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly availableQuantity: number;
  readonly isAvailable: boolean;
}

export interface CustomerProductDetail {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly gender: 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
  readonly shop: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly operationalStatus: string;
    readonly acceptsOnlineOrders: boolean;
  };
  readonly description: string | null;
  readonly material: string | null;
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly careInstructions: string | null;
  readonly returnEligible: boolean;
  readonly returnWindowDays: number;
  readonly images: readonly CustomerProductImage[];
  readonly variants: readonly CustomerProductVariant[];
}

export type CustomerProductDetailResult =
  | { readonly kind: 'SUCCESS'; readonly product: CustomerProductDetail }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerProductFailureKind };

export type CustomerAddToCartResult =
  | {
      readonly kind: 'SUCCESS';
      readonly cartItemCount: number;
      readonly cartShopId: string;
    }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerProductFailureKind };

export interface CustomerProductPort {
  getProduct(productId: string): Promise<CustomerProductDetailResult>;
  addToCart(
    variantId: string,
    quantity: number,
    replaceExistingCart: boolean,
  ): Promise<CustomerAddToCartResult>;
}
