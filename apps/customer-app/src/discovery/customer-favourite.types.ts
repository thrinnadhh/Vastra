export interface CustomerFavouriteShop {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoObjectKey: string | null;
  readonly coverImageObjectKey: string | null;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
  readonly favouritedAt: string;
}

export type CustomerFavouriteFailureKind = 'OFFLINE' | 'NOT_FOUND' | 'ERROR';

export type CustomerFavouriteListResult =
  | { readonly kind: 'SUCCESS'; readonly shops: readonly CustomerFavouriteShop[] }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerFavouriteFailureKind };

export type CustomerFavouriteMutationResult =
  | { readonly kind: 'SUCCESS'; readonly shopId: string; readonly isFavourite: boolean }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerFavouriteFailureKind };

export interface CustomerFavouritePort {
  listFavouriteShops(): Promise<CustomerFavouriteListResult>;
  setFavouriteShop(shopId: string, isFavourite: boolean): Promise<CustomerFavouriteMutationResult>;
}

export interface CustomerFavouriteState {
  readonly shops: readonly CustomerFavouriteShop[];
  readonly isLoading: boolean;
  readonly isStale: boolean;
  readonly failureKind: CustomerFavouriteFailureKind | null;
  readonly pendingShopIds: ReadonlySet<string>;
  readonly statusMessage: string | null;
}

export const INITIAL_CUSTOMER_FAVOURITE_STATE: CustomerFavouriteState = {
  shops: [],
  isLoading: true,
  isStale: false,
  failureKind: null,
  pendingShopIds: new Set<string>(),
  statusMessage: null,
};
