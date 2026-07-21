import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerCoordinates,
  CustomerServiceabilityPort,
  CustomerServiceabilityResult,
} from './customer-location.types';

export class ApiCustomerServiceabilityAdapter implements CustomerServiceabilityPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async checkLocation(
    coordinates: CustomerCoordinates,
  ): Promise<CustomerServiceabilityResult> {
    try {
      const response = await this.apiClient.request('getCustomerHome', {
        query: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          shopLimit: 1,
          productLimit: 1,
        },
      });

      const nearbyShopCount = response.data.data.nearbyShops.length;
      return nearbyShopCount > 0
        ? { kind: 'SERVICEABLE', nearbyShopCount }
        : { kind: 'OUTSIDE_SERVICE_AREA' };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }
}
