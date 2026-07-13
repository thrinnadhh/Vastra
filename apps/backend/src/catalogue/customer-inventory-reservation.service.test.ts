import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerInventoryReservationGateway,
  CustomerInventoryReservationConflictError,
  CustomerInventoryReservationGatewayUnavailableError,
  CustomerInventoryReservationIdempotencyConflictError,
  CustomerInventoryReservationInsufficientInventoryError,
} from './customer-inventory-reservation.gateway';
import { CustomerInventoryReservationService } from './customer-inventory-reservation.service';
import type {
  CreateCustomerInventoryReservationCommand,
  CustomerInventoryReservationSnapshot,
  CustomerOwnedCartRecord,
  CustomerOwnedReservationRecord,
  CustomerVisibleVariantRecord,
  ReleaseCustomerInventoryReservationCommand,
} from './customer-inventory-reservation.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CART_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const RESERVATION_ID = '60000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '70000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createSnapshot(
  overrides: Partial<CustomerInventoryReservationSnapshot> = {},
): CustomerInventoryReservationSnapshot {
  return {
    id: RESERVATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    replayed: false,
    shopId: SHOP_ID,
    variantId: VARIANT_ID,
    cartId: CART_ID,
    quantity: 2,
    status: 'ACTIVE',
    expiresAt: '2026-07-14T12:15:00.000Z',
    createdAt: '2026-07-14T12:00:00.000Z',
    releasedAt: null,
    movement: {
      id: '61',
      shopId: SHOP_ID,
      variantId: VARIANT_ID,
      movementType: 'ONLINE_ORDER_RESERVED',
      quantityChange: 0,
      reservedChange: 2,
      damagedChange: 0,
      stockBefore: 5,
      stockAfter: 5,
      reservedBefore: 0,
      reservedAfter: 2,
      damagedBefore: 0,
      damagedAfter: 0,
      referenceType: 'INVENTORY_RESERVATION',
      referenceId: RESERVATION_ID,
      reason: null,
      performedBy: ACTOR_ID,
      sourceMethod: 'SYSTEM',
      createdAt: '2026-07-14T12:00:00.000Z',
    },
    balance: {
      persisted: true,
      stockOnHand: 5,
      reservedQuantity: 2,
      damagedQuantity: 0,
      availableQuantity: 3,
      reorderLevel: 1,
      version: 3,
      lastCountedAt: null,
      updatedAt: '2026-07-14T12:00:00.000Z',
    },
    ...overrides,
  };
}

class StubGateway implements CustomerInventoryReservationGateway {
  public cart: CustomerOwnedCartRecord | null = {
    id: CART_ID,
    shopId: SHOP_ID,
    status: 'ACTIVE',
  };

  public variant: CustomerVisibleVariantRecord | null = {
    id: VARIANT_ID,
    shopId: SHOP_ID,
    isActive: true,
  };

  public ownedReservation: CustomerOwnedReservationRecord | null = {
    id: RESERVATION_ID,
    shopId: SHOP_ID,
    variantId: VARIANT_ID,
    cartId: CART_ID,
    status: 'ACTIVE',
  };

  public snapshot = createSnapshot();
  public error: Error | null = null;
  public createCommand: CreateCustomerInventoryReservationCommand | null = null;
  public releaseCommand: ReleaseCustomerInventoryReservationCommand | null = null;

  public findOwnedActiveCart(
    _client: SupabaseClient,
    _cartId: string,
  ): Promise<CustomerOwnedCartRecord | null> {
    void _client;
    void _cartId;
    return Promise.resolve(this.cart);
  }

  public findVisibleVariant(
    _client: SupabaseClient,
    _variantId: string,
  ): Promise<CustomerVisibleVariantRecord | null> {
    void _client;
    void _variantId;
    return Promise.resolve(this.variant);
  }

  public findOwnedReservation(
    _client: SupabaseClient,
    _reservationId: string,
  ): Promise<CustomerOwnedReservationRecord | null> {
    void _client;
    void _reservationId;
    return Promise.resolve(this.ownedReservation);
  }

  public createReservation(
    command: CreateCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    this.createCommand = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.snapshot);
  }

  public releaseReservation(
    command: ReleaseCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    this.releaseCommand = command;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(
      createSnapshot({
        idempotencyKey: null,
        status: 'RELEASED',
        releasedAt: '2026-07-14T12:05:00.000Z',
        movement: {
          ...this.snapshot.movement,
          id: '62',
          movementType: 'ONLINE_ORDER_RELEASED',
          reservedChange: -2,
          reservedBefore: 2,
          reservedAfter: 0,
          reason: command.reason,
        },
        balance: {
          ...this.snapshot.balance,
          reservedQuantity: 0,
          availableQuantity: 5,
          version: 4,
        },
      }),
    );
  }
}

function validCreateBody(): Record<string, unknown> {
  return {
    cartId: CART_ID,
    variantId: VARIANT_ID,
    quantity: 2,
    ttlSeconds: 900,
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

describe('CustomerInventoryReservationService', () => {
  let gateway: StubGateway;
  let service: CustomerInventoryReservationService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerInventoryReservationService(gateway);
  });

  it('creates an RLS-prechecked cart reservation', async () => {
    const response = await service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody());

    expect(response.data.reservation.status).toBe('ACTIVE');
    expect(gateway.createCommand).toStrictEqual({
      cartId: CART_ID,
      variantId: VARIANT_ID,
      quantity: 2,
      ttlSeconds: 900,
      idempotencyKey: IDEMPOTENCY_KEY,
      actorId: ACTOR_ID,
    });
  });

  it('uses the default reservation TTL when omitted', async () => {
    const body = validCreateBody();
    delete body['ttlSeconds'];

    await service.createReservation(context, IDEMPOTENCY_KEY, body);

    expect(gateway.createCommand?.ttlSeconds).toBe(900);
  });

  it('rejects a missing or inactive owned cart before trusted mutation', async () => {
    gateway.cart = null;

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('CART_NOT_FOUND');
    expect(gateway.createCommand).toBeNull();
  });

  it('rejects a non-visible or cross-shop variant', async () => {
    gateway.variant = {
      id: VARIANT_ID,
      shopId: '30000000-0000-4000-8000-000000000002',
      isActive: true,
    };

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('VARIANT_NOT_FOUND');
  });

  it('maps insufficient availability to a conflict', async () => {
    gateway.error = new CustomerInventoryReservationInsufficientInventoryError();

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(409);
    expect(readCode(error)).toBe('INSUFFICIENT_INVENTORY');
  });

  it('maps active-reservation conflicts', async () => {
    gateway.error = new CustomerInventoryReservationConflictError();

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(409);
    expect(readCode(error)).toBe('RESERVATION_CONFLICT');
  });

  it('maps idempotency conflicts', async () => {
    gateway.error = new CustomerInventoryReservationIdempotencyConflictError();

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(409);
    expect(readCode(error)).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('releases an owned reservation with a normalized reason', async () => {
    const response = await service.releaseReservation(context, RESERVATION_ID, {
      reason: '  Removed from cart  ',
    });

    expect(response.data.reservation.status).toBe('RELEASED');
    expect(gateway.releaseCommand).toStrictEqual({
      reservationId: RESERVATION_ID,
      reason: 'Removed from cart',
      actorId: ACTOR_ID,
    });
  });

  it('rejects a reservation hidden by RLS', async () => {
    gateway.ownedReservation = null;

    const error = await captureHttpException(
      service.releaseReservation(context, RESERVATION_ID, {}),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('RESERVATION_NOT_FOUND');
    expect(gateway.releaseCommand).toBeNull();
  });

  it('maps provider failures to a retryable service-unavailable error', async () => {
    gateway.error = new CustomerInventoryReservationGatewayUnavailableError();

    const error = await captureHttpException(
      service.createReservation(context, IDEMPOTENCY_KEY, validCreateBody()),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
