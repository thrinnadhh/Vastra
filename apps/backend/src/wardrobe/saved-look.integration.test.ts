import { describe, expect, it } from 'vitest';

import { parseCreateSavedLookInput, parseUpdateSavedLookInput } from './saved-look.validation';

describe('saved look validation boundary', () => {
  const key = '40000000-0000-4000-8000-000000000001';
  const id = '30000000-0000-4000-8000-000000000001';
  it('preserves request-array order and XOR source identity', () => {
    const input = parseCreateSavedLookInput(
      {
        name: 'Look',
        items: [
          { sourceType: 'WARDROBE_ITEM', wardrobeItemId: id },
          { sourceType: 'PRODUCT_VARIANT', productVariantId: id },
        ],
      },
      key,
    );
    expect(input.items.map((item) => item.sourceType)).toStrictEqual([
      'WARDROBE_ITEM',
      'PRODUCT_VARIANT',
    ]);
  });
  it('rejects partial or ambiguous sources', () => {
    expect(() =>
      parseCreateSavedLookInput(
        {
          name: 'Look',
          items: [{ sourceType: 'WARDROBE_ITEM', wardrobeItemId: id, productVariantId: id }],
        },
        key,
      ),
    ).toThrow();
  });
  it('requires at least one update field', () => {
    expect(() => parseUpdateSavedLookInput({})).toThrow();
  });
});
