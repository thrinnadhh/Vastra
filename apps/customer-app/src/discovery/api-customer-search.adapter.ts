import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerSearchFilters,
  CustomerSearchGender,
  CustomerSearchPort,
  CustomerSearchRequest,
  CustomerSearchResult,
  CustomerSearchSort,
} from './customer-search.types';

interface SearchApiQuery {
  readonly q: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly categoryId?: string;
  readonly gender?: CustomerSearchGender;
  readonly shopId?: string;
  readonly minPricePaise?: number;
  readonly maxPricePaise?: number;
  readonly availableOnly: boolean;
  readonly sort: CustomerSearchSort;
  readonly cursor?: string;
  readonly limit: number;
}

interface SearchApiProduct {
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
}

interface SearchApiShop {
  readonly id: string;
  readonly name: string;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
}

interface SearchApiResponse {
  readonly data: Readonly<{
    readonly data: Readonly<{
      readonly query: string;
      readonly filters: Readonly<{
        readonly categoryId: string | null;
        readonly genderCategory: CustomerSearchGender | null;
        readonly shopId: string | null;
        readonly minPricePaise: number | null;
        readonly maxPricePaise: number | null;
        readonly availableOnly: boolean;
        readonly sort: CustomerSearchSort;
      }>;
      readonly results: readonly Readonly<{
        readonly product: SearchApiProduct;
        readonly shop: SearchApiShop;
      }>[];
      readonly nextCursor: string | null;
    }>;
  }>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isOfflineFailure(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error['normalized'])) {
    return false;
  }

  const kind = error['normalized']['kind'];
  return kind === 'TRANSPORT' || kind === 'TIMEOUT';
}

function compactQuery(request: CustomerSearchRequest): SearchApiQuery {
  return {
    q: request.query,
    latitude: request.location.latitude,
    longitude: request.location.longitude,
    availableOnly: request.filters.availableOnly,
    sort: request.filters.sort,
    limit: request.limit,
    ...(request.filters.categoryId === null
      ? {}
      : { categoryId: request.filters.categoryId }),
    ...(request.filters.gender === null ? {} : { gender: request.filters.gender }),
    ...(request.filters.shopId === null ? {} : { shopId: request.filters.shopId }),
    ...(request.filters.minPricePaise === null
      ? {}
      : { minPricePaise: request.filters.minPricePaise }),
    ...(request.filters.maxPricePaise === null
      ? {}
      : { maxPricePaise: request.filters.maxPricePaise }),
    ...(request.cursor === null ? {} : { cursor: request.cursor }),
  };
}

function mapFilters(filters: SearchApiResponse['data']['data']['filters']): CustomerSearchFilters {
  return {
    categoryId: filters.categoryId,
    gender: filters.genderCategory,
    shopId: filters.shopId,
    minPricePaise: filters.minPricePaise,
    maxPricePaise: filters.maxPricePaise,
    availableOnly: filters.availableOnly,
    sort: filters.sort,
  };
}

export class ApiCustomerSearchAdapter implements CustomerSearchPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async search(request: CustomerSearchRequest): Promise<CustomerSearchResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('searchCustomerProducts', {
        query: compactQuery(request),
      });
      const response = responseValue as SearchApiResponse;
      const data = response.data.data;

      return {
        kind: 'SUCCESS',
        page: {
          normalizedQuery: data.query,
          filters: mapFilters(data.filters),
          results: data.results.map(({ product, shop }) => ({
            id: product.id,
            shopId: product.shopId,
            shopName: shop.name,
            shopOperationalStatus: shop.operationalStatus,
            shopAcceptsOnlineOrders: shop.acceptsOnlineOrders,
            distanceMeters: shop.distanceMeters,
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
        },
      };
    } catch (error: unknown) {
      return {
        kind: 'FAILURE',
        failureKind: isOfflineFailure(error) ? 'OFFLINE' : 'ERROR',
      };
    }
  }
}
