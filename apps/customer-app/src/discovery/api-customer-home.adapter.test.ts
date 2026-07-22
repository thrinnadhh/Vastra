import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerHomeAdapter } from './api-customer-home.adapter';

function createSuccessfulApiClient(): {
  readonly apiClient: ApiClient;
  readonly request: jest.Mock;
} {
  const request = jest.fn().mockResolvedValue({
    data: {
      success: true,
      data: {
        location: { latitude: 13.6288, longitude: 79.4192 },
        categories: [
          {
            id: 'category-id',
            parentId: null,
            name: 'Western wear',
            slug: 'western-wear',
            description: 'Modern everyday clothing',
            displayOrder: 1,
          },
        ],
        nearbyShops: [
          {
            id: 'shop-id',
            name: 'Tirupati Trends',
            slug: 'tirupati-trends',
            description: null,
            operationalStatus: 'OPEN',
            acceptsOnlineOrders: true,
            distanceMeters: 850,
            serviceRadiusMeters: 5000,
            minimumOrderPaise: 29900,
            averagePreparationMinutes: 20,
            ratingAverage: null,
            ratingCount: 0,
            followerCount: 0,
            isServiceable: true,
          },
        ],
        nearbyProducts: [
          {
            shop: {
              id: 'shop-id',
              name: 'Tirupati Trends',
              slug: 'tirupati-trends',
              description: null,
              operationalStatus: 'OPEN',
              acceptsOnlineOrders: true,
              distanceMeters: 850,
              serviceRadiusMeters: 5000,
              minimumOrderPaise: 29900,
              averagePreparationMinutes: 20,
              ratingAverage: null,
              ratingCount: 0,
              followerCount: 0,
              isServiceable: true,
            },
            product: {
              id: 'product-id',
              shopId: 'shop-id',
              categoryId: 'category-id',
              name: 'Blue cotton shirt',
              slug: 'blue-cotton-shirt',
              brand: 'Local Loom',
              genderCategory: 'MEN',
              primaryImage: {
                id: 'image-id',
                imageType: 'FRONT',
                altText: 'Blue cotton shirt',
                displayOrder: 0,
                isPrimary: true,
                imageUrl: 'https://images.example.test/shirt.jpg',
                thumbnailUrl: null,
              },
              minSellingPricePaise: 79900,
              maxSellingPricePaise: 99900,
              availableVariantCount: 3,
              totalAvailableQuantity: 8,
              isAvailable: true,
            },
          },
        ],
      },
      meta: { requestId: null },
    },
    status: 200,
    requestId: 'request-id',
  });

  return { apiClient: { request }, request };
}

describe('ApiCustomerHomeAdapter', () => {
  it('loads bounded Home data through the generated operation and maps screen-safe fields', async () => {
    const { apiClient, request } = createSuccessfulApiClient();
    const adapter = new ApiCustomerHomeAdapter(apiClient);

    await expect(adapter.loadHome({ latitude: 13.6288, longitude: 79.4192 })).resolves.toEqual({
      kind: 'SUCCESS',
      content: {
        location: { latitude: 13.6288, longitude: 79.4192 },
        categories: [
          {
            id: 'category-id',
            name: 'Western wear',
            description: 'Modern everyday clothing',
          },
        ],
        nearbyShops: [
          {
            id: 'shop-id',
            name: 'Tirupati Trends',
            operationalStatus: 'OPEN',
            acceptsOnlineOrders: true,
            distanceMeters: 850,
            minimumOrderPaise: 29900,
            averagePreparationMinutes: 20,
          },
        ],
        nearbyProducts: [
          {
            id: 'product-id',
            shopId: 'shop-id',
            shopName: 'Tirupati Trends',
            name: 'Blue cotton shirt',
            brand: 'Local Loom',
            genderCategory: 'MEN',
            primaryImageUrl: 'https://images.example.test/shirt.jpg',
            primaryImageAlt: 'Blue cotton shirt',
            minimumSellingPricePaise: 79900,
            maximumSellingPricePaise: 99900,
            availableVariantCount: 3,
            totalAvailableQuantity: 8,
            isAvailable: true,
          },
        ],
      },
    });
    expect(request).toHaveBeenCalledWith('getCustomerHome', {
      query: {
        latitude: 13.6288,
        longitude: 79.4192,
        shopLimit: 8,
        productLimit: 16,
      },
    });
  });

  it('classifies transport and timeout failures as offline recovery', async () => {
    const request = jest.fn().mockRejectedValue({ normalized: { kind: 'TRANSPORT' } });
    const apiClient: ApiClient = { request };

    await expect(
      new ApiCustomerHomeAdapter(apiClient).loadHome({ latitude: 13.6288, longitude: 79.4192 }),
    ).resolves.toEqual({ kind: 'FAILURE', failureKind: 'OFFLINE' });
  });

  it('keeps contract and server failures recoverable without inventing data', async () => {
    const request = jest.fn().mockRejectedValue(new Error('contract failure'));
    const apiClient: ApiClient = { request };

    await expect(
      new ApiCustomerHomeAdapter(apiClient).loadHome({ latitude: 13.6288, longitude: 79.4192 }),
    ).resolves.toEqual({ kind: 'FAILURE', failureKind: 'ERROR' });
  });
});
