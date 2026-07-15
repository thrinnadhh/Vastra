import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { WardrobeGatewayError } from './wardrobe.gateway';
import { WardrobeItemCreateService } from './wardrobe-item-create.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const UPLOAD_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const ITEM_ID = '40000000-0000-4000-8000-000000000001';
const OBJECT_KEY = `${ACTOR_ID}/${UPLOAD_ID}.webp`;
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'token',
  supabase: emptyClient,
};

class RecordingGateway implements WardrobeGateway {
  public args: Record<string, unknown> | null = null;
  public error: Error | null = null;

  public execute(_name: string, args: Record<string, unknown>): Promise<unknown> {
    this.args = args;
    if (this.error !== null) return Promise.reject(this.error);
    return Promise.resolve({
      id: ITEM_ID,
      ownerCustomerId: ACTOR_ID,
      storageObjectKey: OBJECT_KEY,
      category: 'Kurta',
      colour: 'Blue',
      occasion: 'Festive',
      season: 'All season',
      notes: null,
      status: 'ACTIVE',
      createdAt: '2026-07-16T09:00:00.000Z',
      updatedAt: '2026-07-16T09:00:00.000Z',
    });
  }

  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('https://storage.example.test/item');
  }

  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

function errorCode(error: unknown): string {
  if (!(error instanceof HttpException)) throw error;
  const response = error.getResponse() as { error: { code: string } };
  return response.error.code;
}

describe('WardrobeItemCreateService', () => {
  let gateway: RecordingGateway;
  let service: WardrobeItemCreateService;

  beforeEach(() => {
    gateway = new RecordingGateway();
    service = new WardrobeItemCreateService(gateway);
  });

  it('finalizes an upload and never exposes its object key', async () => {
    const item = await service.create(context, KEY, {
      uploadId: UPLOAD_ID,
      category: ' Kurta ',
      colour: ' Blue ',
      occasion: ' Festive ',
      season: ' All season ',
      notes: '   ',
    });

    expect(item.imageUrl).toBe('https://storage.example.test/item');
    expect(item).not.toHaveProperty('storageObjectKey');
    expect(gateway.args).toMatchObject({
      p_actor: ACTOR_ID,
      p_upload_id: UPLOAD_ID,
      p_category: 'Kurta',
      p_notes: null,
      p_idempotency_key: KEY,
    });
  });

  it('rejects unknown or invalid metadata', async () => {
    await expect(
      service.create(context, KEY, {
        uploadId: UPLOAD_ID,
        category: '',
        colour: 'Blue',
        occasion: 'Festive',
        season: 'All season',
        extra: true,
      }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'VALIDATION_ERROR');
  });

  it('maps a changed idempotent request to conflict', async () => {
    gateway.error = new WardrobeGatewayError('P0010');
    await expect(
      service.create(context, KEY, {
        uploadId: UPLOAD_ID,
        category: 'Kurta',
        colour: 'Blue',
        occasion: 'Festive',
        season: 'All season',
      }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'IDEMPOTENCY_CONFLICT');
  });

  it('maps missing or inconsistent media to the documented error', async () => {
    gateway.error = new WardrobeGatewayError('P0021');
    await expect(
      service.create(context, KEY, {
        uploadId: UPLOAD_ID,
        category: 'Kurta',
        colour: 'Blue',
        occasion: 'Festive',
        season: 'All season',
      }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'WARDROBE_MEDIA_INVALID');
  });
});
