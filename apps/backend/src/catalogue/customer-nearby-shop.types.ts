import type { ShopOperationalStatus } from './merchant-shop-context.types';

export interface ServiceableLocationSnapshot {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerNearbyShopSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
  readonly isServiceable: true;
}

export interface CustomerNearbyShopQuery {
  readonly latitude: number;
  readonly longitude: number;
  readonly limit: number;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListCustomerNearbyShopsResponse {
  readonly success: true;
  readonly data: {
    readonly location: ServiceableLocationSnapshot;
    readonly shops: readonly CustomerNearbyShopSnapshot[];
  };
  readonly meta: ResponseMeta;
}
