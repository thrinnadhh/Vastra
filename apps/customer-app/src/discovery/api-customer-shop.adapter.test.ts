import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerShopAdapter } from './api-customer-shop.adapter';

const location = { latitude: 13.6288, longitude: 79.4192 };

function createApiClient(request: jest.Mock): ApiClient {
  return { request };
}

describe('ApiCustomerShopAdapter', () => {
  it('loads nearby shops from the generated location operation', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        data: {
          location,
          shops: [
            {
              id: 'shop-id',
              name: 'Tirupati Trends',
              slug: 'tirupati-trends',
              description: 'Local fashion shop',
              operationalStatus: 'OPEN',
              acceptsOnlineOrders: true,
              distanceMeters: 850,
              serviceRadiusMeters: 5000,
              minimumOrderPaise: 29900,
              averagePreparationMinutes: 20,
              ratingAverage: 4.5,
              ratingCount: 18,
              followerCount: 120,
            },
          ],
        },
      },
    });
    const adapter = new ApiCustomerShopAdapter(createApiClient(request));

    await expect(adapter.listNearby(location, 50)).resolves.toEqual({
      kind: 'SUCCESS',
      location,
      shops: [
        {
          id: 'shop-id',
          name: 'Tirupati Trends',
          slug: 'tirupati-trends',
          description: 'Local fashion shop',
          operationalStatus: 'OPEN',
          acceptsOnlineOrders: true,
          distanceMeters: 850,
          serviceRadiusMeters: 5000,
          minimumOrderPaise: 29900,
          averagePreparationMinutes: 20,
          ratingAverage: 4.5,
          ratingCount: 18,
          followerCount: 120,
        },
      ],
    });
    expect(request).toHaveBeenCalledWith('listCustomerNearbyShops', {
      query: { latitude: 13.6288, longitude: 79.4192, limit: 50 },
    });
  });

  it('maps authoritative shop serviceability, ordering state, and hours', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        data: {
          shop: {
            id: 'shop-id',
            name: 'Tirupati Trends',
            slug: 'tirupati-trends',
            description: 'Local fashion shop',
            phoneNumber: '+919999999999',
            email: 'shop@example.test',
            location,
            operationalStatus: 'OPEN',
            acceptsOnlineOrders: true,
            orderingStatus: 'ACCEPTING_ORDERS',
            canPlaceOrder: true,
            serviceability: {
              customerLatitude: location.latitude,
              customerLongitude: location.longitude,
              distanceMeters: 850,
              serviceRadiusMeters: 5000,
              isServiceable: true,
            },
            todayHours: {
              date: '2026-07-22',
              dayOfWeek: 3,
              timeZone: 'Asia/Kolkata',
              source: 'WEEKLY',
              isClosed: false,
              opensAt: '10:00',
              closesAt: '21:00',
              isOpenNow: true,
            },
            weeklyHours: [],
            minimumOrderPaise: 29900,
            averagePreparationMinutes: 20,
            ratingAverage: 4.5,
            ratingCount: 18,
            followerCount: 120,
          },
        },
      },
    });
    const adapter = new ApiCustomerShopAdapter(createApiClient(request));

    await expect(adapter.getDetail('shop-id', location)).resolves.toEqual({
      kind: 'SUCCESS',
      shop: {
        id: 'shop-id',
        name: 'Tirupati Trends',
        slug: 'tirupati-trends',
        description: 'Local fashion shop',
        phoneNumber: '+919999999999',
        email: 'shop@example.test',
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        orderingStatus: 'ACCEPTING_ORDERS',
        canPlaceOrder: true,
        distanceMeters: 850,
        serviceRadiusMeters: 5000,
        isServiceable: true,
        todayHours: {
          date: '2026-07-22',
          dayOfWeek: 3,
          timeZone: 'Asia/Kolkata',
          source: 'WEEKLY',
          isClosed: false,
          opensAt: '10:00',
          closesAt: '21:00',
          isOpenNow: true,
        },
        minimumOrderPaise: 29900,
        averagePreparationMinutes: 20,
        ratingAverage: 4.5,
        ratingCount: 18,
        followerCount: 120,
      },
    });
    expect(request).toHaveBeenCalledWith('getCustomerShopDetail', {
      path: { shopId: 'shop-id' },
      query: { latitude: 13.6288, longitude: 79.4192 },
    });
  });

  it('forwards opaque catalogue cursors and maps product cards', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        data: {
          shop: { id: 'shop-id', name: 'Tirupati Trends' },
          products: [
            {
              id: 'product-id',
              shopId: 'shop-id',
              categoryId: 'category-id',
              name: 'Blue cotton shirt',
              slug: 'blue-cotton-shirt',
              brand: 'Local Loom',
              genderCategory: 'MEN',
              primaryImage: {
                imageUrl: 'https://images.example.test/shirt.jpg',
                altText: 'Blue cotton shirt',
              },
              minSellingPricePaise: 79900,
              maxSellingPricePaise: 99900,
              availableVariantCount: 3,
              totalAvailableQuantity: 8,
              isAvailable: true,
            },
          ],
          nextCursor: null,
        },
      },
    });
    const adapter = new ApiCustomerShopAdapter(createApiClient(request));

    await expect(adapter.listProducts('shop-id', 'opaque-cursor', 20)).resolves.toEqual({
      kind: 'SUCCESS',
      products: [
        {
          id: 'product-id',
          shopId: 'shop-id',
          categoryId: 'category-id',
          name: 'Blue cotton shirt',
          brand: 'Local Loom',
          gender: 'MEN',
          imageUrl: 'https://images.example.test/shirt.jpg',
          imageAlt: 'Blue cotton shirt',
          minimumSellingPricePaise: 79900,
          maximumSellingPricePaise: 99900,
          availableVariantCount: 3,
          totalAvailableQuantity: 8,
          isAvailable: true,
        },
      ],
      nextCursor: null,
    });
    expect(request).toHaveBeenCalledWith('listCustomerShopProducts', {
      path: { shopId: 'shop-id' },
      query: { limit: 20, cursor: 'opaque-cursor' },
    });
  });

  it('classifies transport failures as offline', async () => {
    const adapter = new ApiCustomerShopAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { kind: 'TRANSPORT' } })),
    );

    await expect(adapter.listNearby(location, 50)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'OFFLINE',
    });
  });
});
