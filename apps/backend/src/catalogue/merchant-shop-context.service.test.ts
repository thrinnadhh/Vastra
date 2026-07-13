import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantShopContextGateway,
  MerchantShopContextDataInvalidError,
  MerchantShopContextGatewayUnavailableError,
} from './merchant-shop-context.gateway';
import { MerchantShopContextService } from './merchant-shop-context.service';
import type { MerchantCatalogueShopSnapshot } from './merchant-shop-context.types';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const MERCHANT_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';

function createContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: MERCHANT_ID,
      email: 'merchant@example.test',
      accountType: 'MERCHANT',
      status: 'ACTIVE',
    },
    accessToken: 'merchant-token',
    assuranceLevel: 'aal1',
    supabase: emptySupabaseClient,
  };
}

function createShop(): MerchantCatalogueShopSnapshot {
  return {
    id: SHOP_ID,
    shopCode: 'VAS001',
    name: 'Vastra Store',
    slug: 'vastra-store',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    serviceRadiusMeters: 5000,
    minimumOrderPaise: 0,
    averagePreparationMinutes: 15,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

class RecordingMerchantShopContextGateway implements MerchantShopContextGateway {
  public calls: string[] = [];
  public shops: readonly MerchantCatalogueShopSnapshot[] = [createShop()];
  public shop: MerchantCatalogueShopSnapshot | null = createShop();
  public error: Error | null = null;

  public findOwnedShops(): Promise<readonly MerchantCatalogueShopSnapshot[]> {
    this.calls.push('list');

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.shops);
  }

  public findOwnedShopById(): Promise<MerchantCatalogueShopSnapshot | null> {
    this.calls.push('get');

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.shop);
  }
}

function requireHttpErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected object response');
  }

  const errorValue = (response as Record<string, unknown>)['error'];

  if (typeof errorValue !== 'object' || errorValue === null || Array.isArray(errorValue)) {
    throw new TypeError('Expected error object');
  }

  const code = (errorValue as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected string error code');
  }

  return code;
}

describe('MerchantShopContextService', () => {
  let gateway: RecordingMerchantShopContextGateway;
  let service: MerchantShopContextService;

  beforeEach(() => {
    gateway = new RecordingMerchantShopContextGateway();
    service = new MerchantShopContextService(gateway);
  });

  it('lists only the shops returned from the merchant-scoped gateway', async () => {
    const response = await service.listOwnedShops(createContext());

    expect(response).toStrictEqual({
      success: true,
      data: {
        shops: gateway.shops,
      },
      meta: {
        requestId: null,
      },
    });
    expect(gateway.calls).toStrictEqual(['list']);
  });

  it('returns an owned shop for downstream catalogue operations', async () => {
    const response = await service.getOwnedShop(createContext(), SHOP_ID);

    expect(response.data.shop).toStrictEqual(createShop());
    expect(gateway.calls).toStrictEqual(['get']);
  });

  it('rejects an invalid shop identifier before querying the gateway', async () => {
    await expect(service.getOwnedShop(createContext(), 'not-a-uuid')).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'VALIDATION_ERROR',
    );

    expect(gateway.calls).toStrictEqual([]);
  });

  it('hides missing and cross-merchant shops behind SHOP_NOT_FOUND', async () => {
    gateway.shop = null;

    await expect(service.getOwnedShop(createContext(), SHOP_ID)).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'SHOP_NOT_FOUND',
    );
  });

  it('maps provider failures to a retryable service-unavailable error', async () => {
    gateway.error = new MerchantShopContextGatewayUnavailableError();

    await expect(service.listOwnedShops(createContext())).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });

  it('maps malformed provider data to an internal catalogue-state error', async () => {
    gateway.error = new MerchantShopContextDataInvalidError();

    await expect(service.listOwnedShops(createContext())).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'CATALOGUE_STATE_INVALID',
    );
  });
});
