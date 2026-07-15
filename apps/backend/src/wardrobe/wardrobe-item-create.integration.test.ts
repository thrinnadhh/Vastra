import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { WardrobeItemController } from './wardrobe-item.controller';
import { WardrobeItemCreateService } from './wardrobe-item-create.service';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const UPLOAD_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

class Gateway implements WardrobeGateway {
  public execute(): Promise<unknown> {
    return Promise.resolve({
      id: '40000000-0000-4000-8000-000000000001',
      ownerCustomerId: ACTOR_ID,
      storageObjectKey: `${ACTOR_ID}/${UPLOAD_ID}.webp`,
      category: 'Kurta', colour: 'Blue', occasion: 'Festive', season: 'All season', notes: null,
      status: 'ACTIVE', createdAt: '2026-07-16T09:00:00.000Z', updatedAt: '2026-07-16T09:00:00.000Z',
    });
  }
  public createSignedImageUrl(): Promise<string> { return Promise.resolve('https://storage.example.test/item'); }
  public removeObject(): Promise<void> { return Promise.resolve(); }
}

const context: AuthenticatedRequestContext = {
  actor: { id: ACTOR_ID, email: 'customer@example.test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token', supabase: emptyClient,
};

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function server(application: INestApplication): Server {
  const value: unknown = application.getHttpServer();

  if (!isHttpServer(value)) {
    throw new TypeError('Expected HTTP server');
  }

  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

describe('POST /customer/wardrobe/items', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WardrobeItemController],
      providers: [WardrobeItemCreateService, { provide: WARDROBE_GATEWAY, useClass: Gateway }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedHttpRequest, _res: unknown, next: () => void) => { req.authContext = context; next(); });
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns the documented item without private storage data', async () => {
    const response = await request(server(app))
      .post('/customer/wardrobe/items')
      .set('Idempotency-Key', KEY)
      .send({ uploadId: UPLOAD_ID, category: 'Kurta', colour: 'Blue', occasion: 'Festive', season: 'All season' })
      .expect(201);

    const body: unknown = response.body;
    const item = requireRecord(body, 'response body');

    expect(item['imageUrl']).toBe('https://storage.example.test/item');
    expect(item).not.toHaveProperty('storageObjectKey');
  });
});
