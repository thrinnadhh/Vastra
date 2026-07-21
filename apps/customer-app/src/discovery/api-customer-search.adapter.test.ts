import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerSearchAdapter } from './api-customer-search.adapter';
import { DEFAULT_CUSTOMER_SEARCH_FILTERS } from './customer-search.types';

const location = { latitude: 13.6288, longitude: 79.4192 };

describe('ApiCustomerSearchAdapter', () => {
  it('sends normalized filters and maps a cursor page', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          query: 'cotton shirt',
          filters: {
            categoryId: null,
            genderCategory: 'MEN',
            shopId: null,
            minPricePaise: 50000,
            maxPricePaise: 100000,
            availableOnly: true,
            sort: 'PRICE_ASC',
          },
          location,
          results: [
            {
              shop: {
                id: 'shop-id',
                name: 'Tirupati Trends',
                operationalStatus: 'OPEN',
                acceptsOnlineOrders: true,
                distanceMeters: 850,
              },
              product: {
                id: 'product-id',
                shopId: 'shop-id',
                categoryId: 'category-id',
                name: 'Blue cotton shirt',
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
            },
          ],
          nextCursor: 'djE6MjA',
        },
        meta: { requestId: null },
      },
      status: 200,
      requestId: 'request-id',
    });
    const apiClient: ApiClient = { request };
    const adapter = new ApiCustomerSearchAdapter(apiClient);

    await expect(
      adapter.search({
        query: 'cotton shirt',
        location,
        filters: {
          ...DEFAULT_CUSTOMER_SEARCH_FILTERS,
          gender: 'MEN',
          minPricePaise: 50000,
          maxPricePaise: 100000,
          sort: 'PRICE_ASC',
        },
        cursor: null,
        limit: 20,
      }),
    ).resolves.toEqual({
      kind: 'SUCCESS',
      page: {
        normalizedQuery: 'cotton shirt',
        filters: {
          categoryId: null,
          gender: 'MEN',
          shopId: null,
          minPricePaise: 50000,
          maxPricePaise: 100000,
          availableOnly: true,
          sort: 'PRICE_ASC',
        },
        results: [
          {
            id: 'product-id',
            shopId: 'shop-id',
            shopName: 'Tirupati Trends',
            shopOperationalStatus: 'OPEN',
            shopAcceptsOnlineOrders: true,
            distanceMeters: 850,
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
        nextCursor: 'djE6MjA',
      },
    });
    expect(request).toHaveBeenCalledWith('searchCustomerProducts', {
      query: {
        q: 'cotton shirt',
        latitude: 13.6288,
        longitude: 79.4192,
        availableOnly: true,
        sort: 'PRICE_ASC',
        limit: 20,
        gender: 'MEN',
        minPricePaise: 50000,
        maxPricePaise: 100000,
      },
    });
  });

  it('passes the opaque server cursor without decoding it', async () => {
    const request = jest.fn().mockResolvedValue({
      data: {
        data: {
          query: 'dress',
          filters: {
            categoryId: null,
            genderCategory: null,
            shopId: null,
            minPricePaise: null,
            maxPricePaise: null,
            availableOnly: true,
            sort: 'RELEVANCE',
          },
          results: [],
          nextCursor: null,
        },
      },
    });
    const adapter = new ApiCustomerSearchAdapter({ request });

    await adapter.search({
      query: 'dress',
      location,
      filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
      cursor: 'opaque-cursor',
      limit: 20,
    });

    expect(request).toHaveBeenCalledWith('searchCustomerProducts', {
      query: expect.objectContaining({ cursor: 'opaque-cursor' }),
    });
  });

  it('classifies transport failures as offline and other failures as recoverable errors', async () => {
    const offline = new ApiCustomerSearchAdapter({
      request: jest.fn().mockRejectedValue({ normalized: { kind: 'TIMEOUT' } }),
    });
    const error = new ApiCustomerSearchAdapter({
      request: jest.fn().mockRejectedValue(new Error('server failure')),
    });
    const search = {
      query: 'dress',
      location,
      filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
      cursor: null,
      limit: 20,
    } as const;

    await expect(offline.search(search)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'OFFLINE',
    });
    await expect(error.search(search)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'ERROR',
    });
  });
});
