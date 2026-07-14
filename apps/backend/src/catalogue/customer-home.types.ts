import type { CustomerCatalogueProductCard } from './customer-catalogue-read.types';
import type { CustomerNearbyShopSnapshot } from './customer-nearby-shop.types';

export interface CustomerHomeQuery {
  readonly latitude: number;
  readonly longitude: number;
  readonly shopLimit: number;
  readonly productLimit: number;
}

export interface CustomerHomeCategorySnapshot {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly displayOrder: number;
}

export interface CustomerHomeProductItem {
  readonly product: CustomerCatalogueProductCard;
  readonly shop: CustomerNearbyShopSnapshot;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface GetCustomerHomeResponse {
  readonly success: true;
  readonly data: {
    readonly location: {
      readonly latitude: number;
      readonly longitude: number;
    };
    readonly categories: readonly CustomerHomeCategorySnapshot[];
    readonly nearbyShops: readonly CustomerNearbyShopSnapshot[];
    readonly nearbyProducts: readonly CustomerHomeProductItem[];
  };
  readonly meta: ResponseMeta;
}
