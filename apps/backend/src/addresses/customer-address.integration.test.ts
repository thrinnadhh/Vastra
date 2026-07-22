import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerAddressController } from './customer-address.controller';
import type { CustomerAddressGateway } from './customer-address.gateway';
import { CustomerAddressService } from './customer-address.service';
import { CUSTOMER_ADDRESS_GATEWAY } from './customer-address.tokens';

const ID = '10000000-0000-4000-8000-000000000001';
const KEY = '20000000-0000-4000-8000-000000000001';
const ADDRESS = {
  id: ID,
  label: 'Home',
  recipientName: 'Customer',
  phoneNumber: '9000000001',
  line1: '1 Main Road',
  line2: null,
  landmark: null,
  area: 'Tirupati',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN',
  latitude: 13.6,
  longitude: 79.4,
  isDefault: true,
  serviceable: true,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
} as const;
const context: AuthenticatedRequestContext = {
  actor: { id: ID, email: 'customer@test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: {} as SupabaseClient,
};
class Gateway implements CustomerAddressGateway {
  list(_c: SupabaseClient) {
    void _c;
    return Promise.resolve([ADDRESS]);
  }
  create(_c: SupabaseClient) {
    void _c;
    return Promise.resolve(ADDRESS);
  }
  get(_c: SupabaseClient) {
    void _c;
    return Promise.resolve(ADDRESS);
  }
  update(_c: SupabaseClient) {
    void _c;
    return Promise.resolve(ADDRESS);
  }
  remove(_c: SupabaseClient) {
    void _c;
    return Promise.resolve({ deletedAddressId: ID, defaultAddressId: null });
  }
  setDefault(_c: SupabaseClient) {
    void _c;
    return Promise.resolve(ADDRESS);
  }
}
function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(app: INestApplication): Server {
  const value: unknown = app.getHttpServer();
  if (!isHttpServer(value)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }
  return value;
}

describe('customer address integration', () => {
  let app: INestApplication | undefined;
  let http: Server;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomerAddressController],
      providers: [
        CustomerAddressService,
        { provide: CUSTOMER_ADDRESS_GATEWAY, useValue: new Gateway() },
      ],
    }).compile();
    const application = module.createNestApplication();
    application.use((req: AuthenticatedHttpRequest, _res: unknown, next: () => void) => {
      void _res;
      req.authContext = context;
      next();
    });
    app = application;
    await application.init();
    http = requireHttpServer(application);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('lists and reads only through the authenticated context', async () => {
    expect((await request(http).get('/customer/addresses')).status).toBe(200);
    expect((await request(http).get(`/customer/addresses/${ID}`)).status).toBe(200);
  });
  it('creates, updates, selects default and deletes with idempotency keys', async () => {
    const body = {
      label: 'Home',
      recipientName: 'Customer',
      phoneNumber: '9000000001',
      line1: '1 Main Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      postalCode: '517501',
      countryCode: 'IN',
      latitude: 13.6,
      longitude: 79.4,
      isDefault: true,
    };
    expect(
      (await request(http).post('/customer/addresses').set('Idempotency-Key', KEY).send(body))
        .status,
    ).toBe(201);
    expect(
      (
        await request(http)
          .patch(`/customer/addresses/${ID}`)
          .set('Idempotency-Key', KEY)
          .send({ label: 'Office' })
      ).status,
    ).toBe(200);
    expect(
      (await request(http).put(`/customer/addresses/${ID}/default`).set('Idempotency-Key', KEY))
        .status,
    ).toBe(200);
    expect(
      (await request(http).delete(`/customer/addresses/${ID}`).set('Idempotency-Key', KEY)).status,
    ).toBe(200);
  });
  it('rejects invalid coordinates and absent idempotency', async () => {
    expect((await request(http).post('/customer/addresses').send({ latitude: 99 })).status).toBe(
      400,
    );
  });
});
