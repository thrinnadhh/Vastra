import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOfflineSaleGateway,
  MerchantOfflineSaleGatewayUnavailableError,
  MerchantOfflineSaleIdempotencyConflictError,
  MerchantOfflineSaleInsufficientInventoryError,
} from './merchant-offline-sale.gateway';
import { MerchantOfflineSaleService } from './merchant-offline-sale.service';
import type { MerchantOfflineSaleSnapshot } from './merchant-offline-sale.types';
import type { MerchantShopContextService } from './merchant-shop-context.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '72000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createSale(): MerchantOfflineSaleSnapshot {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    saleNumber: 'OS-70000000000040008000000000000001',
    idempotencyKey: IDEMPOTENCY_KEY,
    replayed: false,
    shopId: SHOP_ID,
    merchantId: ACTOR_ID,
    customerPhone: '9000000000',
    subtotalPaise: 200000,
    discountPaise: 10000,
    taxPaise: 5000,
    totalPaise: 195000,
    paymentMethod: 'UPI',
    status: 'COMPLETED',
    recordedBy: ACTOR_ID,
    createdAt: '2026-07-14T00:00:00.000Z',
    items: [
      {
        id: '71000000-0000-4000-8000-000000000001',
        variantId: VARIANT_ID,
        quantity: 2,
        unitPricePaise: 100000,
        discountPaise: 10000,
        totalPaise: 190000,
        identificationMethod: 'BARCODE',
        movementId: '41',
        balance: {
          persisted: true,
          stockOnHand: 8,
          reservedQuantity: 1,
          damagedQuantity: 1,
          availableQuantity: 6,
          reorderLevel: 2,
          version: 3,
          lastCountedAt: null,
          updatedAt: '2026-07-14T00:00:00.000Z',
        },
      },
    ],
  };
}

class OwnedShopService {
  public calls = 0;

  public requireOwnedShop(
    contextValue: AuthenticatedRequestContext,
    shopId: string,
  ): Promise<{ readonly id: string }> {
    void contextValue;
    void shopId;
    this.calls += 1;
    return Promise.resolve({ id: SHOP_ID });
  }
}

class StubGateway implements MerchantOfflineSaleGateway {
  public sale = createSale();
  public error: Error | null = null;
  public command: Parameters<MerchantOfflineSaleGateway['createOfflineSale']>[0] | null = null;

  public createOfflineSale(
    command: Parameters<MerchantOfflineSaleGateway['createOfflineSale']>[0],
  ): Promise<MerchantOfflineSaleSnapshot> {
    this.command = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.sale);
  }
}

function validBody(): Record<string, unknown> {
  return {
    shopId: SHOP_ID,
    customerPhone: ' 9000000000 ',
    taxPaise: 5000,
    paymentMethod: 'UPI',
    items: [
      {
        variantId: VARIANT_ID,
        quantity: 2,
        unitPricePaise: 100000,
        discountPaise: 10000,
        identificationMethod: 'BARCODE',
      },
    ],
  };
}

function readCode(error: HttpException): string {
  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected structured error response');
  }

  const apiError = (response as Record<string, unknown>)['error'];

  if (typeof apiError !== 'object' || apiError === null || Array.isArray(apiError)) {
    throw new TypeError('Expected structured API error');
  }

  const code = (apiError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code');
  }

  return code;
}

async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected promise to reject');
}

describe('MerchantOfflineSaleService', () => {
  let shopService: OwnedShopService;
  let gateway: StubGateway;
  let service: MerchantOfflineSaleService;

  beforeEach(() => {
    shopService = new OwnedShopService();
    gateway = new StubGateway();
    service = new MerchantOfflineSaleService(
      shopService as unknown as MerchantShopContextService,
      gateway,
    );
  });

  it('creates an owned-shop sale with normalized input', async () => {
    const response = await service.createOfflineSale(context, IDEMPOTENCY_KEY, validBody());

    expect(response.data.sale.totalPaise).toBe(195000);
    expect(shopService.calls).toBe(1);
    expect(gateway.command).toMatchObject({
      shopId: SHOP_ID,
      actorId: ACTOR_ID,
      customerPhone: '9000000000',
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it('rejects missing idempotency keys', async () => {
    const error = await captureHttpException(
      service.createOfflineSale(context, undefined, validBody()),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects duplicate variants before calling the gateway', async () => {
    const body = validBody();
    const item: Record<string, unknown> = {
      variantId: VARIANT_ID,
      quantity: 1,
      unitPricePaise: 100000,
      discountPaise: 0,
      identificationMethod: 'MANUAL_SEARCH',
    };

    body['items'] = [item, { ...item }];

    const error = await captureHttpException(
      service.createOfflineSale(context, IDEMPOTENCY_KEY, body),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.command).toBeNull();
  });

  it('maps idempotency conflicts', async () => {
    gateway.error = new MerchantOfflineSaleIdempotencyConflictError();

    const error = await captureHttpException(
      service.createOfflineSale(context, IDEMPOTENCY_KEY, validBody()),
    );

    expect(error.getStatus()).toBe(409);
    expect(readCode(error)).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('maps insufficient inventory conflicts', async () => {
    gateway.error = new MerchantOfflineSaleInsufficientInventoryError();

    const error = await captureHttpException(
      service.createOfflineSale(context, IDEMPOTENCY_KEY, validBody()),
    );

    expect(error.getStatus()).toBe(409);
    expect(readCode(error)).toBe('NEGATIVE_INVENTORY_REJECTED');
  });

  it('maps provider failures to service unavailable', async () => {
    gateway.error = new MerchantOfflineSaleGatewayUnavailableError();

    const error = await captureHttpException(
      service.createOfflineSale(context, IDEMPOTENCY_KEY, validBody()),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
