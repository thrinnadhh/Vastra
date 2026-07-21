import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerServiceabilityAdapter } from './api-customer-serviceability.adapter';

function createApiClient(nearbyShopCount: number): {
  readonly apiClient: ApiClient;
  readonly request: jest.Mock;
} {
  const nearbyShops = Array.from({ length: nearbyShopCount }, (_, index) => ({
    id: `shop-${String(index)}`,
  }));
  const request = jest.fn().mockResolvedValue({
    data: {
      success: true,
      data: {
        location: { latitude: 13.6288, longitude: 79.4192 },
        categories: [],
        nearbyShops,
        nearbyProducts: [],
      },
      meta: { requestId: null },
    },
    status: 200,
    requestId: 'request-id',
  });

  return { apiClient: { request } as unknown as ApiClient, request };
}

describe('ApiCustomerServiceabilityAdapter', () => {
  it('checks the typed customer-home operation with bounded limits', async () => {
    const { apiClient, request } = createApiClient(1);
    const adapter = new ApiCustomerServiceabilityAdapter(apiClient);

    await expect(
      adapter.checkLocation({ latitude: 13.6288, longitude: 79.4192 }),
    ).resolves.toEqual({ kind: 'SERVICEABLE', nearbyShopCount: 1 });
    expect(request).toHaveBeenCalledWith('getCustomerHome', {
      query: {
        latitude: 13.6288,
        longitude: 79.4192,
        shopLimit: 1,
        productLimit: 1,
      },
    });
  });

  it('reports an unsupported area when no nearby shop is returned', async () => {
    const { apiClient } = createApiClient(0);

    await expect(
      new ApiCustomerServiceabilityAdapter(apiClient).checkLocation({
        latitude: 13.6288,
        longitude: 79.4192,
      }),
    ).resolves.toEqual({ kind: 'OUTSIDE_SERVICE_AREA' });
  });

  it('keeps transport and contract failures recoverable', async () => {
    const request = jest.fn().mockRejectedValue(new Error('offline'));
    const apiClient = { request } as unknown as ApiClient;

    await expect(
      new ApiCustomerServiceabilityAdapter(apiClient).checkLocation({
        latitude: 13.6288,
        longitude: 79.4192,
      }),
    ).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });
});
