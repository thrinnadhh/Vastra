import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerFavouriteFailureKind,
  CustomerFavouriteListResult,
  CustomerFavouriteMutationResult,
  CustomerFavouritePort,
} from './customer-favourite.types';

interface FavouriteListApiResponse {
  readonly data: {
    readonly data: {
      readonly shops: readonly {
        readonly id: string;
        readonly name: string;
        readonly slug: string;
        readonly logoObjectKey: string | null;
        readonly coverImageObjectKey: string | null;
        readonly operationalStatus: string;
        readonly acceptsOnlineOrders: boolean;
        readonly ratingAverage: number | null;
        readonly ratingCount: number;
        readonly followerCount: number;
        readonly favouritedAt: string;
      }[];
    };
  };
}

interface FavouriteMutationApiResponse {
  readonly data: {
    readonly data: {
      readonly shopId: string;
      readonly isFavourite: boolean;
    };
  };
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function failureKind(error: unknown): CustomerFavouriteFailureKind {
  if (!isRecord(error) || !isRecord(error['normalized'])) return 'ERROR';
  const normalized = error['normalized'];
  if (normalized['kind'] === 'TRANSPORT' || normalized['kind'] === 'TIMEOUT') return 'OFFLINE';
  if (normalized['status'] === 404 || normalized['code'] === 'SHOP_NOT_FOUND') return 'NOT_FOUND';
  return 'ERROR';
}

export class ApiCustomerFavouriteAdapter implements CustomerFavouritePort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async listFavouriteShops(): Promise<CustomerFavouriteListResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('listCustomerFavouriteShops', {});
      const response = responseValue as FavouriteListApiResponse;
      return { kind: 'SUCCESS', shops: response.data.data.shops };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }

  public async setFavouriteShop(
    shopId: string,
    isFavourite: boolean,
  ): Promise<CustomerFavouriteMutationResult> {
    try {
      const responseValue: unknown = await this.apiClient.request(
        isFavourite ? 'addCustomerFavouriteShop' : 'removeCustomerFavouriteShop',
        { path: { shopId } },
      );
      const response = responseValue as FavouriteMutationApiResponse;
      return {
        kind: 'SUCCESS',
        shopId: response.data.data.shopId,
        isFavourite: response.data.data.isFavourite,
      };
    } catch (error: unknown) {
      return { kind: 'FAILURE', failureKind: failureKind(error) };
    }
  }
}
