import { Inject, Injectable } from '@nestjs/common';

import { rethrowWardrobeError } from './wardrobe-error.mapper';
import type { WardrobeGateway } from './wardrobe.gateway';
import {
  isRecord,
  requireNullableString,
  requireString,
  WardrobeDataInvalidError,
} from './wardrobe-item.parser';
import type { LookItem, SavedLook } from './saved-look.types';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';

interface ResolutionRow {
  readonly savedLookItemId: string;
  readonly wardrobeObjectKey: string | null;
  readonly productImageObjectKey: string | null;
  readonly currentSellingPricePaise: number | null;
  readonly availableQuantity: number | null;
}

function nullableInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new WardrobeDataInvalidError();
  }
  return parsed;
}

function parseRows(value: unknown): ResolutionRow[] {
  if (!Array.isArray(value)) throw new WardrobeDataInvalidError();
  return value.map((entry) => {
    if (!isRecord(entry)) throw new WardrobeDataInvalidError();
    return {
      savedLookItemId: requireString(entry, 'savedLookItemId'),
      wardrobeObjectKey: requireNullableString(entry, 'wardrobeObjectKey'),
      productImageObjectKey: requireNullableString(entry, 'productImageObjectKey'),
      currentSellingPricePaise: nullableInteger(entry, 'currentSellingPricePaise'),
      availableQuantity: nullableInteger(entry, 'availableQuantity'),
    };
  });
}

@Injectable()
export class SavedLookResolutionService {
  public constructor(
    @Inject(WARDROBE_GATEWAY)
    private readonly gateway: WardrobeGateway,
  ) {}

  public async resolve(actorId: string, look: SavedLook): Promise<SavedLook> {
    const [resolved] = await this.resolveMany(actorId, [look]);
    if (resolved === undefined) throw new WardrobeDataInvalidError();
    return resolved;
  }

  public async resolveMany(actorId: string, looks: SavedLook[]): Promise<SavedLook[]> {
    if (looks.length === 0) return [];
    try {
      const rows = parseRows(
        await this.gateway.execute('resolve_saved_look_items', {
          p_actor: actorId,
          p_look_ids: looks.map((look) => look.id),
        }),
      );
      const rowByItemId = new Map(rows.map((row) => [row.savedLookItemId, row]));
      const resolvedItems = new Map<string, Promise<LookItem>>();
      for (const look of looks) {
        for (const item of look.items) {
          const row = rowByItemId.get(item.id);
          if (row === undefined) throw new WardrobeDataInvalidError();
          resolvedItems.set(item.id, this.resolveItem(item, row));
        }
      }
      return await Promise.all(
        looks.map(async (look) => ({
          ...look,
          items: await Promise.all(
            look.items.map((item) => {
              const resolvedItem = resolvedItems.get(item.id);

              if (resolvedItem === undefined) {
                throw new WardrobeDataInvalidError();
              }

              return resolvedItem;
            }),
          ),
        })),
      );
    } catch (error: unknown) {
      return rethrowWardrobeError(error);
    }
  }

  private async resolveItem(item: LookItem, row: ResolutionRow): Promise<LookItem> {
    let imageUrl: string | null = null;
    if (item.sourceType === 'WARDROBE_ITEM' && row.wardrobeObjectKey !== null) {
      imageUrl = await this.gateway.createSignedImageUrl(row.wardrobeObjectKey);
    } else if (
      item.sourceType === 'PRODUCT_VARIANT' &&
      row.productImageObjectKey !== null &&
      this.gateway.createPublicProductImageUrl !== undefined
    ) {
      imageUrl = this.gateway.createPublicProductImageUrl(row.productImageObjectKey);
    }
    return {
      ...item,
      currentSellingPricePaise: row.currentSellingPricePaise,
      availableQuantity: row.availableQuantity,
      imageUrl,
    };
  }
}
