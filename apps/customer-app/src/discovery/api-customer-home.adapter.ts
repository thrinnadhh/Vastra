import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerHomeCoordinates,
  CustomerHomeLoadResult,
  CustomerHomePort,
} from './customer-home.types';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isOfflineFailure(error: unknown): boolean {
  if (!isRecord(error) || !isRecord(error['normalized'])) {
    return false;
  }

  const kind = error['normalized']['kind'];
  return kind === 'TRANSPORT' || kind === 'TIMEOUT';
}

export class ApiCustomerHomeAdapter implements CustomerHomePort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async loadHome(coordinates: CustomerHomeCoordinates): Promise<CustomerHomeLoadResult> {
    try {
      const response = await this.apiClient.request('getCustomerHome', {
        query: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          shopLimit: 8,
          productLimit: 16,
        },
      });
      const data = response.data.data;

      return {
        kind: 'SUCCESS',
        content: {
          location: data.location,
          categories: data.categories.map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description,
          })),
          nearbyShops: data.nearbyShops.map((shop) => ({
            id: shop.id,
            name: shop.name,
            operationalStatus: shop.operationalStatus,
            acceptsOnlineOrders: shop.acceptsOnlineOrders,
            distanceMeters: shop.distanceMeters,
            minimumOrderPaise: shop.minimumOrderPaise,
            averagePreparationMinutes: shop.averagePreparationMinutes,
          })),
          nearbyProducts: data.nearbyProducts.map(({ product, shop }) => ({
            id: product.id,
            shopId: shop.id,
            shopName: shop.name,
            name: product.name,
            brand: product.brand,
            genderCategory: product.genderCategory,
            primaryImageUrl: product.primaryImage?.imageUrl ?? null,
            primaryImageAlt: product.primaryImage?.altText ?? null,
            minimumSellingPricePaise: product.minSellingPricePaise,
            maximumSellingPricePaise: product.maxSellingPricePaise,
            availableVariantCount: product.availableVariantCount,
            totalAvailableQuantity: product.totalAvailableQuantity,
            isAvailable: product.isAvailable,
          })),
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
