import { describe, expect, it } from 'vitest';

import { parseUpdateWardrobeItemInput, parseWardrobeListLimit } from './wardrobe-item.validation';

describe('wardrobe item management contract', () => {
  it('enforces the documented 1-100 list limit', () => {
    expect(parseWardrobeListLimit('1')).toBe(1);
    expect(parseWardrobeListLimit('100')).toBe(100);
    expect(() => parseWardrobeListLimit('101')).toThrow();
  });

  it('rejects immutable-field updates', () => {
    expect(() => parseUpdateWardrobeItemInput({ status: 'DELETED' })).toThrow();
    expect(() => parseUpdateWardrobeItemInput({ storageObjectKey: 'private' })).toThrow();
  });
});
