import type { CustomerHomeCoordinates } from './customer-home.types';
import type { CustomerSearchGender } from './customer-search.types';

export type CustomerShopOrderingStatus =
  | 'ACCEPTING_ORDERS'
  | 'BUSY'
  | 'CLOSED'
  | 'OUTSIDE_SERVICE_AREA'
  | 'ONLINE_ORDERS_DISABLED';

export interface CustomerNearbyShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
}

export interface CustomerShopHours {
  readonly date: string;
  readonly timeZone: 'Asia/Kolkata';
  readonly source: 'WEEKLY' | 'SPECIAL_DATE' | 'NONE';
  readonly isClosed: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly isOpenNow: boolean;
}

export interface CustomerShopDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly phoneNumber: string;
  readonly email: string | null;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
  readonly orderingStatus: CustomerShopOrderingStatus;
  readonly canPlaceOrder: boolean;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
  readonly isServiceable: boolean;
  readonly todayHours: CustomerShopHours;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
}

export interface CustomerShopProduct {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly gender: CustomerSearchGender;
  readonly imageUrl: string | null;
  readonly imageAlt: string | null;
  readonly minimumSellingPricePaise: number | null;
  readonly maximumSellingPricePaise: number | null;
  readonly availableVariantCount: number;
  readonly totalAvailableQuantity: number;
  readonly isAvailable: boolean;
}

export type CustomerShopFailureKind = 'OFFLINE' | 'ERROR';

export type CustomerNearbyShopsResult =
  | {
      readonly kind: 'SUCCESS';
      readonly location: CustomerHomeCoordinates;
      readonly shops: readonly CustomerNearbyShop[];
    }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerShopFailureKind };

export type CustomerShopDetailResult =
  | { readonly kind: 'SUCCESS'; readonly shop: CustomerShopDetail }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerShopFailureKind };

export type CustomerShopProductsResult =
  | {
      readonly kind: 'SUCCESS';
      readonly products: readonly CustomerShopProduct[];
      readonly nextCursor: string | null;
    }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerShopFailureKind };

export interface CustomerShopPort {
  listNearby(
    location: CustomerHomeCoordinates,
    limit: number,
  ): Promise<CustomerNearbyShopsResult>;
  getDetail(
    shopId: string,
    location: CustomerHomeCoordinates,
  ): Promise<CustomerShopDetailResult>;
  listProducts(
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerShopProductsResult>;
}
