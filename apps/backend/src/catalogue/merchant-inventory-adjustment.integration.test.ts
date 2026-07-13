import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantInventoryAdjustmentController } from './merchant-inventory-adjustment.controller';
import type { MerchantInventoryAdjustmentGateway } from './merchant-inventory-adjustment.gateway';
import { MerchantInventoryAdjustmentVersionConflictError } from './merchant-inventory-adjustment.gateway';
import { MerchantInventoryAdjustmentService } from './merchant-inventory-adjustment.service';
import { MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY } from './merchant-inventory-adjustment.tokens';
import type {
  MerchantInventoryAdjustmentSnapshot,
  MerchantInventoryMovementPage,
  MerchantOwnedInventoryVariant,
} from './merchant-inventory-adjustment.types';

const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '70000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createAdjustment(): MerchantInventoryAdjustmentSnapshot {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    replayed: false,
    action: 'ADD_STOCK',
    movement: {
      id: '81',
      shopId: SHOP_ID,
      variantId: VARIANT_ID,
      movementType: 'STOCK_RECEIVED',
      quantityChange: 5,
      reservedChange: 0,
      damagedChange: 0,
      stockBefore: 10,
      stockAfter: 15,
      reservedBefore: 1,
      reservedAfter: 1,
      damagedBefore: 1,
      damagedAfter: 1,
      referenceType: 'MERCHANT_INVENTORY_ADJUSTMENT',
      referenceId: IDEMPOTENCY_KEY,
      reason: 'New delivery',
      performedBy: ACTOR_ID,
      sourceMethod: 'MANUAL_SEARCH',
      createdAt: '2026-07-13T00:00:00.000Z',
    },
    balance: {
      persisted: true,
      stockOnHand: 15,
      reservedQuantity: 1,
      damagedQuantity: 1,
      availableQuantity: 13,
      reorderLevel: 2,
      version: 2,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
  };
}

class IntegrationGateway implements MerchantInventoryAdjustmentGateway {
  public versionConflict = false;

  public findOwnedVariant(): Promise<MerchantOwnedInventoryVariant | null> {
    return Promise.resolve({
      id: VARIANT_ID,
      shopId: SHOP_ID,
      isActive: true,
    });
  }

  public applyAdjustment(): Promise<MerchantInventoryAdjustmentSnapshot> {
    if (this.versionConflict) {
      return Promise.reject(new MerchantInventoryAdjustmentVersionConflictError());
    }

    return Promise.resolve(createAdjustment());
  }

  public listOwnedMovements(): Promise<MerchantInventoryMovementPage> {
    return Promise.resolve({
      movements: [createAdjustment().movement],
      nextCursor: '80',
    });
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readData(body: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(body, 'response')['data'], 'response data');
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('merchant inventory adjustment integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [MerchantInventoryAdjustmentController],
      providers: [
        MerchantInventoryAdjustmentService,
        {
          provide: MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY,
          useValue: gateway,
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, _response: unknown, next: () => void): void => {
        incomingRequest.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('applies an idempotent merchant inventory adjustment', async () => {
    const response = await request(httpServer)
      .post('/merchant/inventory/adjustments')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        variantId: VARIANT_ID,
        action: 'ADD_STOCK',
        quantity: 5,
        reason: 'New delivery',
        expectedVersion: 1,
      });

    expect(response.status).toBe(200);
    const adjustment = requireRecord(readData(response.body)['adjustment'], 'adjustment');
    expect(adjustment['idempotencyKey']).toBe(IDEMPOTENCY_KEY);
  });

  it('rejects a missing idempotency key', async () => {
    const response = await request(httpServer).post('/merchant/inventory/adjustments').send({
      variantId: VARIANT_ID,
      action: 'ADD_STOCK',
      quantity: 5,
      reason: 'New delivery',
      expectedVersion: 1,
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('returns an inventory conflict for stale versions', async () => {
    gateway.versionConflict = true;

    const response = await request(httpServer)
      .post('/merchant/inventory/adjustments')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        variantId: VARIANT_ID,
        action: 'ADD_STOCK',
        quantity: 5,
        reason: 'New delivery',
        expectedVersion: 1,
      });

    gateway.versionConflict = false;

    expect(response.status).toBe(409);
    expect(readErrorCode(response.body)).toBe('INVENTORY_CONFLICT');
  });

  it('lists immutable inventory movement history', async () => {
    const response = await request(httpServer).get(
      `/merchant/inventory/movements?variantId=${VARIANT_ID}&limit=20`,
    );

    expect(response.status).toBe(200);
    const data = readData(response.body);
    expect(data['variantId']).toBe(VARIANT_ID);
    expect(data['nextCursor']).toBe('80');
  });
});
