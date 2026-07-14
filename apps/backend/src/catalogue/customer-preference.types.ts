import type { ProductGenderCategory } from './merchant-product.types';
import type { ShopOperationalStatus } from './merchant-shop-context.types';

export interface CustomerFavouriteShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoObjectKey: string | null;
  readonly coverImageObjectKey: string | null;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
  readonly favouritedAt: string;
}

export interface CustomerPreferencesSnapshot {
  readonly genderCategories: readonly ProductGenderCategory[];
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly preferredColours: readonly string[];
  readonly preferredSizes: readonly string[];
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
  readonly updatedAt: string | null;
}

export interface ReplaceCustomerPreferencesInput {
  readonly genderCategories: readonly ProductGenderCategory[];
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly preferredColours: readonly string[];
  readonly preferredSizes: readonly string[];
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListCustomerFavouriteShopsResponse {
  readonly success: true;
  readonly data: {
    readonly shops: readonly CustomerFavouriteShopSnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface SetCustomerFavouriteShopResponse {
  readonly success: true;
  readonly data: {
    readonly shopId: string;
    readonly isFavourite: boolean;
  };
  readonly meta: ResponseMeta;
}

export interface GetCustomerPreferencesResponse {
  readonly success: true;
  readonly data: {
    readonly preferences: CustomerPreferencesSnapshot;
  };
  readonly meta: ResponseMeta;
}
