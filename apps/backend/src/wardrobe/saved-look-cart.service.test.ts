import type { SupabaseClient } from '../auth/supabase-client.type';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { WardrobeGateway } from './wardrobe.gateway';
import { SavedLookCartService } from './saved-look-cart.service';

const actor = '10000000-0000-4000-8000-000000000001';
const look = '20000000-0000-4000-8000-000000000001';
const first = '30000000-0000-4000-8000-000000000002';
const second = '30000000-0000-4000-8000-000000000001';
const key = '40000000-0000-4000-8000-000000000001';
const cart = '50000000-0000-4000-8000-000000000001';
const context: AuthenticatedRequestContext = {
  actor: { id: actor, email: 'c@example.test', accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: Object.freeze({}) as unknown as SupabaseClient,
};
class Gateway implements WardrobeGateway {
  public args: Record<string, unknown> = {};
  public execute(_name: string, args: Record<string, unknown>): Promise<unknown> {
    this.args = args;
    return Promise.resolve({ cartId: cart, addedVariantIds: [second, first] });
  }
  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('url');
  }
  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SavedLookCartService', () => {
  it('normalizes the selected UUID set and returns the exact transfer contract', async () => {
    const gateway = new Gateway();
    const service = new SavedLookCartService(gateway);
    const result = await service.addProducts(context, look, key, {
      productVariantIds: [first, second],
    });
    expect(gateway.args).toMatchObject({
      p_actor: actor,
      p_look_id: look,
      p_variant_ids: [second, first],
      p_idempotency_key: key,
    });
    expect(result).toStrictEqual({ cartId: cart, addedVariantIds: [second, first] });
  });
  it('rejects duplicate selected variants before the transaction', async () => {
    const service = new SavedLookCartService(new Gateway());
    await expect(
      service.addProducts(context, look, key, { productVariantIds: [first, first] }),
    ).rejects.toBeDefined();
  });
});
