import type { SupabaseClient } from '../auth/supabase-client.type';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { SavedLookDuplicationService } from './saved-look-duplication.service';
import { SavedLookResolutionService } from './saved-look-resolution.service';

const actor = '10000000-0000-4000-8000-000000000001';
const source = '20000000-0000-4000-8000-000000000001';
const duplicate = '30000000-0000-4000-8000-000000000001';
const child = '40000000-0000-4000-8000-000000000001';
const key = '50000000-0000-4000-8000-000000000001';
const context: AuthenticatedRequestContext = {
  actor: { id: actor, email: 'c@example.test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: Object.freeze({}) as unknown as SupabaseClient,
};
class Gateway implements WardrobeGateway {
  public args: Record<string, unknown> = {};
  public calls: { name: string; args: Record<string, unknown> }[] = [];
  public execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    this.args = args;
    this.calls.push({ name, args });
    if (name === 'resolve_saved_look_items')
      return Promise.resolve([
        {
          savedLookItemId: child,
          wardrobeObjectKey: null,
          productImageObjectKey: null,
          currentSellingPricePaise: 1000,
          availableQuantity: 2,
        },
      ]);
    return Promise.resolve({
      id: duplicate,
      ownerCustomerId: actor,
      name: 'Copy',
      items: [
        {
          id: child,
          sourceType: 'PRODUCT_VARIANT',
          wardrobeItemId: null,
          productVariantId: source,
          displayPosition: 0,
          currentSellingPricePaise: null,
          availableQuantity: null,
          imageUrl: null,
        },
      ],
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z',
    });
  }
  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('url');
  }
  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SavedLookDuplicationService', () => {
  it('uses a new look and child identity while preserving composition', async () => {
    const gateway = new Gateway();
    const service = new SavedLookDuplicationService(
      gateway,
      new SavedLookResolutionService(gateway),
    );
    const result = await service.duplicate(context, source, key, { name: ' Copy ' });
    expect(result.id).toBe(duplicate);
    expect(result.items[0]?.id).toBe(child);
    expect(gateway.calls.find((call) => call.name === 'duplicate_saved_look')?.args).toMatchObject({
      p_source_look_id: source,
      p_name: 'Copy',
      p_idempotency_key: key,
    });
  });
});
