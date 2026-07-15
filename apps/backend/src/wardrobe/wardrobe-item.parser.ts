import type { InternalWardrobeItem, WardrobeItemStatus } from './wardrobe-item.types';

export class WardrobeDataInvalidError extends Error {
  public constructor() {
    super('Wardrobe response data is invalid');
    this.name = 'WardrobeDataInvalidError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new WardrobeDataInvalidError();
  }

  return value;
}

export function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new WardrobeDataInvalidError();
  }

  return value;
}

export function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new WardrobeDataInvalidError();
  }

  return value;
}

function requireStatus(record: Record<string, unknown>): WardrobeItemStatus {
  const value = record['status'];

  if (value !== 'ACTIVE' && value !== 'DELETED') {
    throw new WardrobeDataInvalidError();
  }

  return value;
}

export function parseInternalWardrobeItem(value: unknown): InternalWardrobeItem {
  if (!isRecord(value)) {
    throw new WardrobeDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    ownerCustomerId: requireString(value, 'ownerCustomerId'),
    storageObjectKey: requireString(value, 'storageObjectKey'),
    category: requireString(value, 'category'),
    colour: requireString(value, 'colour'),
    occasion: requireString(value, 'occasion'),
    season: requireString(value, 'season'),
    notes: requireNullableString(value, 'notes'),
    status: requireStatus(value),
    createdAt: requireTimestamp(value, 'createdAt'),
    updatedAt: requireTimestamp(value, 'updatedAt'),
  };
}
