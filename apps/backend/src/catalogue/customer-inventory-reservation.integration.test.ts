import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerInventoryReservationController } from './customer-inventory-reservation.controller';
import type { CustomerInventoryReservationGateway } from './customer-inventory-reservation.gateway';
import { CustomerInventoryReservationService } from './customer-inventory-reservation.service';
import { CUSTOMER_INVENTORY_RESERVATION_GATEWAY } from './customer-inventory-reservation.tokens';
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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createSnapshot(status: 'ACTIVE' | 'RELEASED'): CustomerInventoryReservationSnapshot {
  const released = status === 'RELEASED';

  return {
    id: RESERVATION_ID,
    idempotencyKey: released ? null : IDEMPOTENCY_KEY,
    replayed: false,
    shopId: SHOP_ID,
    variantId: VARIANT_ID,
    cartId: CART_ID,
    quantity: 1,
    status,
    expiresAt: '2026-07-14T12:15:00.000Z',
    createdAt: '2026-07-14T12:00:00.000Z',
    releasedAt: released ? '2026-07-14T12:05:00.000Z' : null,
    movement: {
      id: released ? '72' : '71',
      shopId: SHOP_ID,
      variantId: VARIANT_ID,
      movementType: released ? 'ONLINE_ORDER_RELEASED' : 'ONLINE_ORDER_RESERVED',
      quantityChange: 0,
      reservedChange: released ? -1 : 1,
      damagedChange: 0,
      stockBefore: 5,
      stockAfter: 5,
      reservedBefore: released ? 1 : 0,
      reservedAfter: released ? 0 : 1,
      damagedBefore: 0,
      damagedAfter: 0,
      referenceType: 'INVENTORY_RESERVATION',
      referenceId: RESERVATION_ID,
      reason: released ? 'Customer released cart reservation' : null,
      performedBy: ACTOR_ID,
      sourceMethod: 'SYSTEM',
      createdAt: '2026-07-14T12:00:00.000Z',
    },
    balance: {
      persisted: true,
      stockOnHand: 5,
      reservedQuantity: released ? 0 : 1,
      damagedQuantity: 0,
      availableQuantity: released ? 5 : 4,
      reorderLevel: 1,
      version: released ? 4 : 3,
      lastCountedAt: null,
      updatedAt: '2026-07-14T12:05:00.000Z',
    },
  };
}

class IntegrationGateway implements CustomerInventoryReservationGateway {
  public findOwnedActiveCart(
    _client: SupabaseClient,
    _cartId: string,
  ): Promise<CustomerOwnedCartRecord | null> {
    void _client;
    void _cartId;
    return Promise.resolve({
      id: CART_ID,
      shopId: SHOP_ID,
      status: 'ACTIVE',
    });
  }

  public findVisibleVariant(
    _client: SupabaseClient,
    _variantId: string,
  ): Promise<CustomerVisibleVariantRecord | null> {
    void _client;
    void _variantId;
    return Promise.resolve({
      id: VARIANT_ID,
      shopId: SHOP_ID,
      isActive: true,
    });
  }

  public findOwnedReservation(
    _client: SupabaseClient,
    _reservationId: string,
  ): Promise<CustomerOwnedReservationRecord | null> {
    void _client;
    void _reservationId;
    return Promise.resolve({
      id: RESERVATION_ID,
      shopId: SHOP_ID,
      variantId: VARIANT_ID,
      cartId: CART_ID,
      status: 'ACTIVE',
    });
  }

  public createReservation(
    _command: CreateCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    void _command;
    return Promise.resolve(createSnapshot('ACTIVE'));
  }

  public releaseReservation(
    _command: ReleaseCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    void _command;
    return Promise.resolve(createSnapshot('RELEASED'));
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

describe('customer inventory reservation integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerInventoryReservationController],
      providers: [
        CustomerInventoryReservationService,
        {
          provide: CUSTOMER_INVENTORY_RESERVATION_GATEWAY,
          useValue: new IntegrationGateway(),
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
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

  it('creates a cart reservation', async () => {
    const response = await request(httpServer)
      .post('/customer/inventory/reservations')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        cartId: CART_ID,
        variantId: VARIANT_ID,
        quantity: 1,
        ttlSeconds: 900,
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const reservation = requireRecord(readData(body)['reservation'], 'reservation');

    expect(reservation['status']).toBe('ACTIVE');
    expect(reservation['quantity']).toBe(1);
  });

  it('releases an owned reservation', async () => {
    const response = await request(httpServer)
      .post(`/customer/inventory/reservations/${RESERVATION_ID}/release`)
      .send({ reason: 'Removed from cart' });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const reservation = requireRecord(readData(body)['reservation'], 'reservation');

    expect(reservation['status']).toBe('RELEASED');
  });

  it('rejects a missing idempotency key', async () => {
    const response = await request(httpServer).post('/customer/inventory/reservations').send({
      cartId: CART_ID,
      variantId: VARIANT_ID,
      quantity: 1,
    });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects an invalid reservation identifier', async () => {
    const response = await request(httpServer)
      .post('/customer/inventory/reservations/not-a-uuid/release')
      .send({});

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
