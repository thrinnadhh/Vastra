import { describe, expect, it } from 'vitest';
import { parseLookCartVariantIds } from './saved-look.validation';

describe('look-to-cart request contract', () => {
  it('accepts only a unique non-empty product variant set', () => {
    const one = '30000000-0000-4000-8000-000000000002';
    const two = '30000000-0000-4000-8000-000000000001';
    expect(parseLookCartVariantIds({ productVariantIds: [one, two] })).toStrictEqual([two, one]);
    expect(() => parseLookCartVariantIds({ productVariantIds: [] })).toThrow();
  });
  it('does not accept Wardrobe IDs through another request field', () => {
    expect(() =>
      parseLookCartVariantIds({ wardrobeItemIds: ['30000000-0000-4000-8000-000000000001'] }),
    ).toThrow();
  });
});
