import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import {
  isRecord,
  parseInternalWardrobeItem,
  requireString,
  requireTimestamp,
  WardrobeDataInvalidError,
} from './wardrobe-item.parser';
import type { InternalWardrobeItem, WardrobeItem, WardrobeItemList } from './wardrobe-item.types';
import {
  encodeWardrobeListCursor,
  parseUpdateWardrobeItemInput,
  parseWardrobeIdempotencyKey,
  parseWardrobeListCursor,
  parseWardrobeListLimit,
  parseWardrobeUuid,
} from './wardrobe-item.validation';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

interface ListPayload {
  readonly items: InternalWardrobeItem[];
  readonly nextCursor: { readonly createdAt: string; readonly id: string } | null;
}

function parseListPayload(value: unknown): ListPayload {
  if (!isRecord(value) || !Array.isArray(value['items'])) throw new WardrobeDataInvalidError();
  const next = value['nextCursor'];
  let nextCursor: ListPayload['nextCursor'] = null;
  if (next !== null) {
    if (!isRecord(next)) throw new WardrobeDataInvalidError();
    nextCursor = { createdAt: requireTimestamp(next, 'createdAt'), id: requireString(next, 'id') };
  }
  return { items: value['items'].map(parseInternalWardrobeItem), nextCursor };
}

@Injectable()
export class WardrobeItemManagementService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async list(
    context: AuthenticatedRequestContext,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<WardrobeItemList> {
    try {
      const cursor = parseWardrobeListCursor(cursorValue);
      const limit = parseWardrobeListLimit(limitValue);
      const payload = parseListPayload(
        await this.gateway.execute('list_wardrobe_items', {
          p_actor: context.actor.id,
          p_cursor_created_at: cursor?.createdAt ?? null,
          p_cursor_id: cursor?.id ?? null,
          p_limit: limit,
        }),
      );
      return {
        items: await Promise.all(payload.items.map((item) => this.toPublicItem(item))),
        nextCursor: encodeWardrobeListCursor(payload.nextCursor),
      };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async get(
    context: AuthenticatedRequestContext,
    itemIdValue: unknown,
  ): Promise<WardrobeItem> {
    try {
      const itemId = parseWardrobeUuid(itemIdValue);
      const item = parseInternalWardrobeItem(
        await this.gateway.execute('get_wardrobe_item', {
          p_actor: context.actor.id,
          p_item_id: itemId,
        }),
      );
      return await this.toPublicItem(item);
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async update(
    context: AuthenticatedRequestContext,
    itemIdValue: unknown,
    body: unknown,
  ): Promise<WardrobeItem> {
    try {
      const itemId = parseWardrobeUuid(itemIdValue);
      const patch = parseUpdateWardrobeItemInput(body);
      const item = parseInternalWardrobeItem(
        await this.gateway.execute('update_wardrobe_item', {
          p_actor: context.actor.id,
          p_item_id: itemId,
          p_patch: patch,
        }),
      );
      return await this.toPublicItem(item);
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  public async delete(
    context: AuthenticatedRequestContext,
    itemIdValue: unknown,
    idempotencyKeyValue: unknown,
  ): Promise<{ readonly success: true }> {
    try {
      const itemId = parseWardrobeUuid(itemIdValue);
      const idempotencyKey = parseWardrobeIdempotencyKey(idempotencyKeyValue);
      const result = await this.gateway.execute('delete_wardrobe_item', {
        p_actor: context.actor.id,
        p_item_id: itemId,
        p_idempotency_key: idempotencyKey,
      });
      if (!isRecord(result) || result['success'] !== true) throw new WardrobeDataInvalidError();
      return { success: true };
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  private async toPublicItem(item: InternalWardrobeItem): Promise<WardrobeItem> {
    if (item.status !== 'ACTIVE') throw new WardrobeDataInvalidError();
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
  }
}
