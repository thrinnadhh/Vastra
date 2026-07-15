import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import { isRecord, requireString, WardrobeDataInvalidError } from './wardrobe-item.parser';
import { parseWardrobeIdempotencyKey, parseWardrobeUuid } from './wardrobe-item.validation';
import { parseLookCartVariantIds } from './saved-look.validation';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

export interface CartTransferResult {
  readonly cartId: string;
  readonly addedVariantIds: string[];
}

@Injectable()
export class SavedLookCartService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async addProducts(
    context: AuthenticatedRequestContext,
    lookIdValue: unknown,
    idempotencyKeyValue: unknown,
    body: unknown,
  ): Promise<CartTransferResult> {
    try {
      const lookId = parseWardrobeUuid(lookIdValue);
      const idempotencyKey = parseWardrobeIdempotencyKey(idempotencyKeyValue);
      const variantIds = parseLookCartVariantIds(body);
      const value = await this.gateway.execute('add_saved_look_products_to_cart', {
        p_actor: context.actor.id,
        p_look_id: lookId,
        p_variant_ids: variantIds,
        p_idempotency_key: idempotencyKey,
      });
      if (!isRecord(value) || !Array.isArray(value['addedVariantIds'])) {
        throw new WardrobeDataInvalidError();
      }
      const addedVariantIds = value['addedVariantIds'].map((id) => {
        if (typeof id !== 'string') throw new WardrobeDataInvalidError();
        return id;
      });
      return { cartId: requireString(value, 'cartId'), addedVariantIds };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }
}
