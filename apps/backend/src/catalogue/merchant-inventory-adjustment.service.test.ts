import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantInventoryAdjustmentGateway,
  MerchantInventoryAdjustmentIdempotencyConflictError,
  MerchantInventoryAdjustmentNegativeInventoryError,
  MerchantInventoryAdjustmentVersionConflictError,
} from './merchant-inventory-adjustment.gateway';
import { MerchantInventoryAdjustmentService } from './merchant-inventory-adjustment.service';
import type {
  ApplyMerchantInventoryAdjustmentCommand,
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
  accessToken: 'unit-test-token',
  supabase: emptyClient,
};

function createAdjustment(
  overrides: Partial<MerchantInventoryAdjustmentSnapshot> = {},
): MerchantInventoryAdjustmentSnapshot {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    replayed: false,
    action: 'ADD_STOCK',
    movement: {
      id: '41',
      shopId: SHOP_ID,
      variantId: VARIANT_ID,
      movementType: 'STOCK_RECEIVED',
      quantityChange: 5,
      reservedChange: 0,
      damagedChange: 0,
      stockBefore: 10,
      stockAfter: 15,
      reservedBefore: 2,
      reservedAfter: 2,
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
      reservedQuantity: 2,
      damagedQuantity: 1,
      availableQuantity: 12,
      reorderLevel: 3,
      version: 2,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    ...overrides,
  };
}

class StubGateway implements MerchantInventoryAdjustmentGateway {
  public ownedVariant: MerchantOwnedInventoryVariant | null = {
    id: VARIANT_ID,
    shopId: SHOP_ID,
    isActive: true,
  };

  public adjustment = createAdjustment();
  public adjustmentError: Error | null = null;
  public lastCommand: ApplyMerchantInventoryAdjustmentCommand | null = null;
  public movementPage: MerchantInventoryMovementPage = {
    movements: [createAdjustment().movement],
    nextCursor: null,
  };

  public findOwnedVariant(): Promise<MerchantOwnedInventoryVariant | null> {
    return Promise.resolve(this.ownedVariant);
  }

  public applyAdjustment(
    command: ApplyMerchantInventoryAdjustmentCommand,
  ): Promise<MerchantInventoryAdjustmentSnapshot> {
    this.lastCommand = command;

    if (this.adjustmentError !== null) {
      return Promise.reject(this.adjustmentError);
    }

    return Promise.resolve(this.adjustment);
  }

  public listOwnedMovements(): Promise<MerchantInventoryMovementPage> {
    return Promise.resolve(this.movementPage);
  }
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response = error.getResponse();

  if (typeof response !== 'object' || Array.isArray(response)) {
    throw new TypeError('Expected object error response');
  }

  const responseRecord = response as Record<string, unknown>;
  const apiError = responseRecord['error'];

  if (typeof apiError !== 'object' || apiError === null || Array.isArray(apiError)) {
    throw new TypeError('Expected error details');
  }

  const errorRecord = apiError as Record<string, unknown>;
  const code = errorRecord['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('MerchantInventoryAdjustmentService', () => {
  let gateway: StubGateway;
  let service: MerchantInventoryAdjustmentService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new MerchantInventoryAdjustmentService(gateway);
  });

  it('applies an owned inventory adjustment with actor and shop scope', async () => {
    const response = await service.adjustInventory(context, IDEMPOTENCY_KEY, {
      variantId: VARIANT_ID,
      action: 'ADD_STOCK',
      quantity: 5,
      reason: 'New delivery',
      expectedVersion: 1,
    });

    expect(response.data.adjustment.balance.stockOnHand).toBe(15);
    expect(gateway.lastCommand).toStrictEqual({
      variantId: VARIANT_ID,
      action: 'ADD_STOCK',
      quantity: 5,
      reason: 'New delivery',
      expectedVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
      shopId: SHOP_ID,
      actorId: ACTOR_ID,
    });
  });

  it('requires the idempotency key header', async () => {
    await expect(
      service.adjustInventory(context, undefined, {
        variantId: VARIANT_ID,
        action: 'ADD_STOCK',
        quantity: 5,
        reason: 'New delivery',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects unsupported adjustment actions', async () => {
    await expect(
      service.adjustInventory(context, IDEMPOTENCY_KEY, {
        variantId: VARIANT_ID,
        action: 'OFFLINE_SALE',
        quantity: 1,
        reason: 'Not allowed through adjustments',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR');
  });

  it('maps optimistic version conflicts', async () => {
    gateway.adjustmentError = new MerchantInventoryAdjustmentVersionConflictError();

    await expect(
      service.adjustInventory(context, IDEMPOTENCY_KEY, {
        variantId: VARIANT_ID,
        action: 'ADD_STOCK',
        quantity: 5,
        reason: 'New delivery',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'INVENTORY_CONFLICT');
  });

  it('maps idempotency conflicts', async () => {
    gateway.adjustmentError = new MerchantInventoryAdjustmentIdempotencyConflictError();

    await expect(
      service.adjustInventory(context, IDEMPOTENCY_KEY, {
        variantId: VARIANT_ID,
        action: 'ADD_STOCK',
        quantity: 5,
        reason: 'New delivery',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'IDEMPOTENCY_CONFLICT');
  });

  it('maps adjustments that would create invalid inventory', async () => {
    gateway.adjustmentError = new MerchantInventoryAdjustmentNegativeInventoryError();

    await expect(
      service.adjustInventory(context, IDEMPOTENCY_KEY, {
        variantId: VARIANT_ID,
        action: 'MARK_DAMAGED',
        quantity: 99,
        reason: 'Damaged stock',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'NEGATIVE_INVENTORY_REJECTED');
  });

  it('lists immutable movements with cursor metadata', async () => {
    gateway.movementPage = {
      movements: [createAdjustment().movement],
      nextCursor: '40',
    };

    const response = await service.listMovements(context, VARIANT_ID, '42', '20');

    expect(response.data.variantId).toBe(VARIANT_ID);
    expect(response.data.movements).toHaveLength(1);
    expect(response.data.nextCursor).toBe('40');
  });
});
