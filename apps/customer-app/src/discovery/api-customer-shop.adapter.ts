import type { ApiClient } from '@vastra/api-client';

import type { CustomerHomeCoordinates } from './customer-home.types';
import type {
  CustomerNearbyShopsResult,
  CustomerShopDetailResult,
  CustomerShopOrderingStatus,
  CustomerShopPort,
  CustomerShopProductsResult,
} from './customer-shop.types';
import type { CustomerSearchGender } from './customer-search.types';

interface NearbyShopApiResponse {
  readonly data: Readonly<{
    readonly data: Readonly<{
      readonly location: CustomerHomeCoordinates;
      readonly shops: readonly Readonly<{
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
      }>[];
    }>;
  }>;
}

interface ShopDetailApiResponse {
  readonly data: Readonly<{
    readonly data: Readonly<{
      readonly shop: Readonly<{
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
        readonly serviceability: Readonly<{
          readonly distanceMeters: number;
          readonly serviceRadiusMeters: number;
          readonly isServiceable: boolean;
        }>;
        readonly todayHours: Readonly<{
          readonly date: string;
          readonly timeZone: 'Asia/Kolkata';
          readonly source: 'WEEKLY' | 'SPECIAL_DATE' | 'NONE';
          readonly isClosed: boolean;
          readonly opensAt: string | null;
          readonly closesAt: string | null;
          readonly isOpenNow: boolean;
        }>;
        readonly minimumOrderPaise: number;
        readonly averagePreparationMinutes: number;
        readonly ratingAverage: number | null;
        readonly ratingCount: number;
        readonly followerCount: number;
      }>;
    }>;
  }>;
}

interface ShopProductsApiResponse {
  readonly data: Readonly<{
    readonly data: Readonly<{
      readonly products: readonly Readonly<{
        readonly id: string;
        readonly shopId: string;
        readonly categoryId: string;
        readonly name: string;
        readonly brand: string | null;
        readonly genderCategory: CustomerSearchGender;
        readonly primaryImage: Readonly<{
          readonly imageUrl: string;
          readonly altText: string | null;
        }> | null;
        readonly minSellingPricePaise: number | null;
        readonly maxSellingPricePaise: number | null;
        readonly availableVariantCount: number;
        readonly totalAvailableQuantity: number;
        readonly isAvailable: boolean;
      }>[];
      readonly nextCursor: string | null;
    }>;
  }>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function failureKind(error: unknown): 'OFFLINE' | 'ERROR' {
  if (isRecord(error) && isRecord(error['normalized'])) {
    const kind = error['normalized']['kind'];
    if (kind === 'TRANSPORT' || kind === 'TIMEOUT') {
      return 'OFFLINE';
    }
  }

  return 'ERROR';
}

export class ApiCustomerShopAdapter implements CustomerShopPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async listNearby(
    location: CustomerHomeCoordinates,
    limit: number,
  ): Promise<CustomerNearbyShopsResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('listCustomerNearbyShops', {
        query: {
          latitude: location.latitude,
          longitude: location.longitude,
          limit,
        },
      });
      const response = responseValue as NearbyShopApiResponse;
      const data = response.data.data;

      return {
        kind: 'SUCCESS',
        location: data.location,
        shops: data.shops.map((shop) => ({ ...shop })),
      };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }

  public async getDetail(
    shopId: string,
    location: CustomerHomeCoordinates,
  ): Promise<CustomerShopDetailResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('getCustomerShopDetail', {
        path: { shopId },
        query: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });
      const response = responseValue as ShopDetailApiResponse;
      const shop = response.data.data.shop;

      return {
        kind: 'SUCCESS',
        shop: {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          description: shop.description,
          phoneNumber: shop.phoneNumber,
          email: shop.email,
          operationalStatus: shop.operationalStatus,
          acceptsOnlineOrders: shop.acceptsOnlineOrders,
          orderingStatus: shop.orderingStatus,
          canPlaceOrder: shop.canPlaceOrder,
          distanceMeters: shop.serviceability.distanceMeters,
          serviceRadiusMeters: shop.serviceability.serviceRadiusMeters,
          isServiceable: shop.serviceability.isServiceable,
          todayHours: shop.todayHours,
          minimumOrderPaise: shop.minimumOrderPaise,
          averagePreparationMinutes: shop.averagePreparationMinutes,
          ratingAverage: shop.ratingAverage,
          ratingCount: shop.ratingCount,
          followerCount: shop.followerCount,
        },
      };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }

  public async listProducts(
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerShopProductsResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('listCustomerShopProducts', {
        path: { shopId },
        query: {
          limit,
          ...(cursor === null ? {} : { cursor }),
        },
      });
      const response = responseValue as ShopProductsApiResponse;
      const data = response.data.data;

      return {
        kind: 'SUCCESS',
        products: data.products.map((product) => ({
          id: product.id,
          shopId: product.shopId,
          categoryId: product.categoryId,
          name: product.name,
          brand: product.brand,
          gender: product.genderCategory,
          imageUrl: product.primaryImage?.imageUrl ?? null,
          imageAlt: product.primaryImage?.altText ?? null,
          minimumSellingPricePaise: product.minSellingPricePaise,
          maximumSellingPricePaise: product.maxSellingPricePaise,
          availableVariantCount: product.availableVariantCount,
          totalAvailableQuantity: product.totalAvailableQuantity,
          isAvailable: product.isAvailable,
        })),
        nextCursor: data.nextCursor,
      };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }
}
