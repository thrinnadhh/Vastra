import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerFavouriteAdapter } from './api-customer-favourite.adapter';

function createApiClient(request: jest.Mock): ApiClient {
  return { request };
}

describe('ApiCustomerFavouriteAdapter', () => {
  it('maps the private favourite-shop list', async () => {
    const shops = [
      {
        id: 'shop-id',
        name: 'Tirupati Trends',
        slug: 'tirupati-trends',
        logoObjectKey: null,
        coverImageObjectKey: null,
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        ratingAverage: 4.5,
        ratingCount: 18,
        followerCount: 120,
        favouritedAt: '2026-07-22T04:00:00.000Z',
      },
    ];
    const request = jest.fn().mockResolvedValue({ data: { data: { shops } } });
    const adapter = new ApiCustomerFavouriteAdapter(createApiClient(request));

    await expect(adapter.listFavouriteShops()).resolves.toEqual({ kind: 'SUCCESS', shops });
    expect(request).toHaveBeenCalledWith('listCustomerFavouriteShops', {});
  });

  it('uses distinct generated operations for adding and removing favourites', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ data: { data: { shopId: 'shop-id', isFavourite: true } } })
      .mockResolvedValueOnce({ data: { data: { shopId: 'shop-id', isFavourite: false } } });
    const adapter = new ApiCustomerFavouriteAdapter(createApiClient(request));

    await expect(adapter.setFavouriteShop('shop-id', true)).resolves.toEqual({
      kind: 'SUCCESS',
      shopId: 'shop-id',
      isFavourite: true,
    });
    await expect(adapter.setFavouriteShop('shop-id', false)).resolves.toEqual({
      kind: 'SUCCESS',
      shopId: 'shop-id',
      isFavourite: false,
    });
    expect(request.mock.calls).toEqual([
      ['addCustomerFavouriteShop', { path: { shopId: 'shop-id' } }],
      ['removeCustomerFavouriteShop', { path: { shopId: 'shop-id' } }],
    ]);
  });

  it('classifies offline and missing-shop failures', async () => {
    const offline = new ApiCustomerFavouriteAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { kind: 'TRANSPORT' } })),
    );
    const missing = new ApiCustomerFavouriteAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { code: 'SHOP_NOT_FOUND' } })),
    );

    await expect(offline.listFavouriteShops()).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'OFFLINE',
    });
    await expect(missing.setFavouriteShop('shop-id', true)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'NOT_FOUND',
    });
  });
});
