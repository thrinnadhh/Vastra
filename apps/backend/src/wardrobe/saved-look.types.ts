export type LookItemSourceType = 'WARDROBE_ITEM' | 'PRODUCT_VARIANT';

export interface LookItemInput {
  readonly sourceType: LookItemSourceType;
  readonly wardrobeItemId: string | null;
  readonly productVariantId: string | null;
}

export interface LookItem extends LookItemInput {
  readonly id: string;
  readonly displayPosition: number;
  readonly currentSellingPricePaise: number | null;
  readonly availableQuantity: number | null;
  readonly imageUrl: string | null;
}

export interface SavedLook {
  readonly id: string;
  readonly ownerCustomerId: string;
  readonly name: string;
  readonly items: LookItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavedLookList {
  readonly items: SavedLook[];
  readonly nextCursor: string | null;
}

export interface CreateSavedLookInput {
  readonly name: string;
  readonly items: LookItemInput[];
  readonly idempotencyKey: string;
}

export interface UpdateSavedLookInput {
  readonly name?: string;
  readonly items?: LookItemInput[];
}
