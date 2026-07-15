import type { SupabaseClient } from '../auth/supabase-client.type';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { WardrobeItemManagementService } from './wardrobe-item-management.service';

const ACTOR = '10000000-0000-4000-8000-000000000001';
const ITEM = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;
const context: AuthenticatedRequestContext = {
  actor: { id: ACTOR, email: 'customer@example.test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: emptyClient,
};
const item = {
  id: ITEM,
  ownerCustomerId: ACTOR,
  storageObjectKey: `${ACTOR}/${ITEM}.webp`,
  category: 'Kurta',
  colour: 'Blue',
  occasion: 'Festive',
  season: 'All season',
  notes: null,
  status: 'ACTIVE',
  createdAt: '2026-07-16T10:00:00.000Z',
  updatedAt: '2026-07-16T10:00:00.000Z',
};

class Gateway implements WardrobeGateway {
  public name = '';
  public args: Record<string, unknown> = {};
  public result: unknown = item;
  public execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.name = name;
    this.args = args;
    return Promise.resolve(this.result);
  }
  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('https://storage.example.test/item');
  }
  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

describe('WardrobeItemManagementService', () => {
  let gateway: Gateway;
  let service: WardrobeItemManagementService;
  beforeEach(() => {
    gateway = new Gateway();
    service = new WardrobeItemManagementService(gateway);
  });

  it('lists active items with an opaque cursor and no object keys', async () => {
    gateway.result = { items: [item], nextCursor: { createdAt: item.createdAt, id: ITEM } };
    const result = await service.list(context, undefined, '20');
    expect(result.items[0]).not.toHaveProperty('storageObjectKey');
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(gateway.name).toBe('list_wardrobe_items');
  });

  it('updates only documented metadata', async () => {
    await service.update(context, ITEM, { colour: ' Navy ', notes: null });
    expect(gateway.args).toMatchObject({
      p_actor: ACTOR,
      p_item_id: ITEM,
      p_patch: { colour: 'Navy', notes: null },
    });
  });

  it('submits an idempotent logical deletion', async () => {
    gateway.result = { success: true };
    await expect(service.delete(context, ITEM, KEY)).resolves.toStrictEqual({ success: true });
    expect(gateway.name).toBe('delete_wardrobe_item');
  });
});
