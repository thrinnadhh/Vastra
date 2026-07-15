export type WardrobeItemStatus = 'ACTIVE' | 'DELETED';

export interface WardrobeItem {
  readonly id: string;
  readonly ownerCustomerId: string;
  readonly imageUrl: string | null;
  readonly category: string;
  readonly colour: string;
  readonly occasion: string;
  readonly season: string;
  readonly notes: string | null;
  readonly status: WardrobeItemStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InternalWardrobeItem extends Omit<WardrobeItem, 'imageUrl'> {
  readonly storageObjectKey: string;
}

export interface CreateWardrobeItemInput {
  readonly uploadId: string;
  readonly category: string;
  readonly colour: string;
  readonly occasion: string;
  readonly season: string;
  readonly notes: string | null;
  readonly idempotencyKey: string;
}

export interface UpdateWardrobeItemInput {
  readonly category?: string;
  readonly colour?: string;
  readonly occasion?: string;
  readonly season?: string;
  readonly notes?: string | null;
}

export interface WardrobeItemList {
  readonly items: WardrobeItem[];
  readonly nextCursor: string | null;
}
