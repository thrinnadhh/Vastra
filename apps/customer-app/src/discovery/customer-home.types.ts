export interface CustomerHomeCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerHomeCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

export interface CustomerHomeShop {
  readonly id: string;
  readonly name: string;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
}

export interface CustomerHomeProduct {
  readonly id: string;
  readonly shopId: string;
  readonly shopName: string;
  readonly name: string;
  readonly brand: string | null;
  readonly genderCategory: string;
  readonly primaryImageUrl: string | null;
  readonly primaryImageAlt: string | null;
  readonly minimumSellingPricePaise: number | null;
  readonly maximumSellingPricePaise: number | null;
  readonly availableVariantCount: number;
  readonly totalAvailableQuantity: number;
  readonly isAvailable: boolean;
}

export interface CustomerHomeContent {
  readonly location: CustomerHomeCoordinates;
  readonly categories: readonly CustomerHomeCategory[];
  readonly nearbyShops: readonly CustomerHomeShop[];
  readonly nearbyProducts: readonly CustomerHomeProduct[];
}

export type CustomerHomeFailureKind = 'OFFLINE' | 'ERROR';

export type CustomerHomeLoadResult =
  | { readonly kind: 'SUCCESS'; readonly content: CustomerHomeContent }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerHomeFailureKind };

export interface CustomerHomePort {
  loadHome(coordinates: CustomerHomeCoordinates): Promise<CustomerHomeLoadResult>;
}
