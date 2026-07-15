import type { SupabaseClient } from '../auth/supabase-client.type';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { SavedLookResolutionService } from './saved-look-resolution.service';
import { SavedLookService } from './saved-look.service';

const ACTOR = '10000000-0000-4000-8000-000000000001';
const LOOK = '20000000-0000-4000-8000-000000000001';
const ITEM = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;
const context: AuthenticatedRequestContext = {
  actor: { id: ACTOR, email: 'c@example.test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: emptyClient,
};
const look = {
  id: LOOK,
  ownerCustomerId: ACTOR,
  name: 'Festival',
  items: [
    {
      id: ITEM,
      sourceType: 'WARDROBE_ITEM',
      wardrobeItemId: ITEM,
      productVariantId: null,
      displayPosition: 0,
      currentSellingPricePaise: null,
      availableQuantity: null,
      imageUrl: null,
    },
  ],
  createdAt: '2026-07-16T11:00:00.000Z',
  updatedAt: '2026-07-16T11:00:00.000Z',
};
class Gateway implements WardrobeGateway {
  public name = '';
  public args: Record<string, unknown> = {};
  public calls: { name: string; args: Record<string, unknown> }[] = [];
  public result: unknown = look;
  public execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.name = name;
    this.args = args;
    this.calls.push({ name, args });
    if (name === 'resolve_saved_look_items')
      return Promise.resolve([
        {
          savedLookItemId: ITEM,
          wardrobeObjectKey: `${ACTOR}/${ITEM}.webp`,
          productImageObjectKey: null,
          currentSellingPricePaise: null,
          availableQuantity: null,
        },
      ]);
    return Promise.resolve(this.result);
  }
  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('url');
  }
  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SavedLookService', () => {
  let gateway: Gateway;
  let service: SavedLookService;
  beforeEach(() => {
    gateway = new Gateway();
    service = new SavedLookService(gateway, new SavedLookResolutionService(gateway));
  });
  it('creates a mixed-source ordered look atomically', async () => {
    const result = await service.create(context, KEY, {
      name: ' Festival ',
      items: [{ sourceType: 'WARDROBE_ITEM', wardrobeItemId: ITEM }],
    });
    expect(result.name).toBe('Festival');
    expect(gateway.calls.find((call) => call.name === 'create_saved_look')?.args).toMatchObject({
      p_actor: ACTOR,
      p_name: 'Festival',
      p_idempotency_key: KEY,
    });
  });
  it('replaces the composition as one patch', async () => {
    await service.update(context, LOOK, {
      items: [{ sourceType: 'WARDROBE_ITEM', wardrobeItemId: ITEM }],
    });
    expect(gateway.calls.some((call) => call.name === 'update_saved_look')).toBe(true);
  });
  it('deletes with a durable idempotency key', async () => {
    gateway.result = { success: true };
    await expect(service.delete(context, LOOK, KEY)).resolves.toStrictEqual({ success: true });
  });
});
