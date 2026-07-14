import type {
  CustomerCatalogueImageSnapshot,
  CustomerCatalogueProductCard,
  CustomerCatalogueVariantSnapshot,
} from './customer-catalogue-read.types';
import type { ProductGenderCategory } from './merchant-product.types';
import type { ShopOperationalStatus } from './merchant-shop-context.types';

export const CUSTOMER_PRODUCT_SEARCH_SORTS = [
  'RELEVANCE',
  'DISTANCE',
  'PRICE_ASC',
  'PRICE_DESC',
] as const;

export type CustomerProductSearchSort = (typeof CUSTOMER_PRODUCT_SEARCH_SORTS)[number];

export interface CustomerProductSearchQuery {
  readonly term: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly categoryId: string | null;
  readonly genderCategory: ProductGenderCategory | null;
  readonly shopId: string | null;
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
  readonly availableOnly: boolean;
  readonly sort: CustomerProductSearchSort;
  readonly offset: number;
  readonly limit: number;
}

export interface CustomerProductSearchShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly isServiceable: true;
}

export interface CustomerProductSearchItem {
  readonly product: CustomerCatalogueProductCard;
  readonly shop: CustomerProductSearchShopSnapshot;
}

export interface CustomerProductSearchPage {
  readonly results: readonly CustomerProductSearchItem[];
  readonly nextOffset: number | null;
}

export interface CustomerProductSearchCandidate {
  readonly productId: string;
  readonly shop: CustomerProductSearchShopSnapshot;
  readonly relevanceScore: number;
  readonly sortPricePaise: number;
}

export interface CustomerProductSearchHydratedProduct {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly genderCategory: ProductGenderCategory;
  readonly images: readonly CustomerCatalogueImageSnapshot[];
  readonly variants: readonly CustomerCatalogueVariantSnapshot[];
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface SearchCustomerProductsResponse {
  readonly success: true;
  readonly data: {
    readonly query: string;
    readonly filters: {
      readonly categoryId: string | null;
      readonly genderCategory: ProductGenderCategory | null;
      readonly shopId: string | null;
      readonly minPricePaise: number | null;
      readonly maxPricePaise: number | null;
      readonly availableOnly: boolean;
      readonly sort: CustomerProductSearchSort;
    };
    readonly location: {
      readonly latitude: number;
      readonly longitude: number;
    };
    readonly results: readonly CustomerProductSearchItem[];
    readonly nextCursor: string | null;
  };
  readonly meta: ResponseMeta;
}
