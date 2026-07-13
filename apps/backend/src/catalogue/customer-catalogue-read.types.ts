import type { ProductGenderCategory } from './merchant-product.types';
import type { ProductImageType } from './product-image.types';

export interface CustomerCatalogueShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
}

export interface CustomerCatalogueImageSnapshot {
  readonly id: string;
  readonly imageType: ProductImageType;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
  readonly imageUrl: string;
  readonly thumbnailUrl: string | null;
}

export interface CustomerCatalogueVariantSnapshot {
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

export interface CustomerCatalogueProductCard {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly genderCategory: ProductGenderCategory;
  readonly primaryImage: CustomerCatalogueImageSnapshot | null;
  readonly minSellingPricePaise: number | null;
  readonly maxSellingPricePaise: number | null;
  readonly availableVariantCount: number;
  readonly totalAvailableQuantity: number;
  readonly isAvailable: boolean;
}

export interface CustomerCatalogueProductDetail extends CustomerCatalogueProductCard {
  readonly shop: CustomerCatalogueShopSnapshot;
  readonly description: string | null;
  readonly material: string | null;
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly careInstructions: string | null;
  readonly returnEligible: boolean;
  readonly returnWindowDays: number;
  readonly images: readonly CustomerCatalogueImageSnapshot[];
  readonly variants: readonly CustomerCatalogueVariantSnapshot[];
}

export interface CustomerCatalogueProductPage {
  readonly products: readonly CustomerCatalogueProductCard[];
  readonly nextCursor: string | null;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListCustomerCatalogueProductsResponse {
  readonly success: true;
  readonly data: {
    readonly shop: CustomerCatalogueShopSnapshot;
    readonly products: readonly CustomerCatalogueProductCard[];
    readonly nextCursor: string | null;
  };
  readonly meta: ResponseMeta;
}

export interface GetCustomerCatalogueProductResponse {
  readonly success: true;
  readonly data: {
    readonly product: CustomerCatalogueProductDetail;
  };
  readonly meta: ResponseMeta;
}
