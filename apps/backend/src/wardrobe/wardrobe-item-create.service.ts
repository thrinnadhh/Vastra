import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import { parseInternalWardrobeItem } from './wardrobe-item.parser';
import type { WardrobeItem } from './wardrobe-item.types';
import { parseCreateWardrobeItemInput } from './wardrobe-item.validation';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

@Injectable()
export class WardrobeItemCreateService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async create(
    context: AuthenticatedRequestContext,
    idempotencyKeyValue: unknown,
    body: unknown,
  ): Promise<WardrobeItem> {
    try {
      const input = parseCreateWardrobeItemInput(body, idempotencyKeyValue);
      const value = await this.gateway.execute('finalize_wardrobe_item', {
        p_actor: context.actor.id,
        p_upload_id: input.uploadId,
        p_category: input.category,
        p_colour: input.colour,
        p_occasion: input.occasion,
        p_season: input.season,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      });
      const item = parseInternalWardrobeItem(value);
      const imageUrl = await this.gateway.createSignedImageUrl(item.storageObjectKey);

      return {
        id: item.id,
        ownerCustomerId: item.ownerCustomerId,
        imageUrl,
        category: item.category,
        colour: item.colour,
        occasion: item.occasion,
        season: item.season,
        notes: item.notes,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }
}
