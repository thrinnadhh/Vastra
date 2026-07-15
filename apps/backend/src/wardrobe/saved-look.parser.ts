import type { LookItem, SavedLook } from './saved-look.types';
import {
  isRecord,
  requireNullableString,
  requireString,
  requireTimestamp,
  WardrobeDataInvalidError,
} from './wardrobe-item.parser';

function nullableInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new WardrobeDataInvalidError();
  }
  return parsed;
}

function integer(record: Record<string, unknown>, key: string): number {
  const value = nullableInteger(record, key);
  if (value === null) throw new WardrobeDataInvalidError();
  return value;
}

export function parseLookItem(value: unknown): LookItem {
  if (!isRecord(value)) throw new WardrobeDataInvalidError();
  const sourceType = value['sourceType'];
  const wardrobeItemId = requireNullableString(value, 'wardrobeItemId');
  const productVariantId = requireNullableString(value, 'productVariantId');
  if (!(
    (sourceType === 'WARDROBE_ITEM' && wardrobeItemId !== null && productVariantId === null) ||
    (sourceType === 'PRODUCT_VARIANT' && productVariantId !== null && wardrobeItemId === null)
  )) {
    throw new WardrobeDataInvalidError();
  }
  return {
    id: requireString(value, 'id'),
    sourceType: sourceType,
    wardrobeItemId,
    productVariantId,
    displayPosition: integer(value, 'displayPosition'),
    currentSellingPricePaise: nullableInteger(value, 'currentSellingPricePaise'),
    availableQuantity: nullableInteger(value, 'availableQuantity'),
    imageUrl: requireNullableString(value, 'imageUrl'),
  };
}

export function parseSavedLook(value: unknown): SavedLook {
  if (!isRecord(value) || !Array.isArray(value['items'])) throw new WardrobeDataInvalidError();
  return {
    id: requireString(value, 'id'),
    ownerCustomerId: requireString(value, 'ownerCustomerId'),
    name: requireString(value, 'name'),
    items: value['items'].map(parseLookItem),
    createdAt: requireTimestamp(value, 'createdAt'),
    updatedAt: requireTimestamp(value, 'updatedAt'),
  };
}
