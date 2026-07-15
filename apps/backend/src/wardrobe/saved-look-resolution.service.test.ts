import { describe, expect, it } from 'vitest';
import type { WardrobeGateway } from './wardrobe.gateway';
import { SavedLookResolutionService } from './saved-look-resolution.service';
import type { SavedLook } from './saved-look.types';

const actor = '10000000-0000-4000-8000-000000000001';
const lookId = '20000000-0000-4000-8000-000000000001';
const wardrobeLine = '30000000-0000-4000-8000-000000000001';
const productLine = '40000000-0000-4000-8000-000000000001';
const look: SavedLook = {
  id: lookId,
  ownerCustomerId: actor,
  name: 'Mixed',
  items: [
    {
      id: wardrobeLine,
      sourceType: 'WARDROBE_ITEM',
      wardrobeItemId: wardrobeLine,
      productVariantId: null,
      displayPosition: 0,
      currentSellingPricePaise: null,
      availableQuantity: null,
      imageUrl: null,
    },
    {
      id: productLine,
      sourceType: 'PRODUCT_VARIANT',
      wardrobeItemId: null,
      productVariantId: productLine,
      displayPosition: 1,
      currentSellingPricePaise: null,
      availableQuantity: null,
      imageUrl: null,
    },
  ],
  createdAt: '2026-07-16T13:00:00Z',
  updatedAt: '2026-07-16T13:00:00Z',
};
class Gateway implements WardrobeGateway {
  public execute(): Promise<unknown> {
    return Promise.resolve([
      {
        savedLookItemId: wardrobeLine,
        wardrobeObjectKey: `${actor}/item.webp`,
        productImageObjectKey: null,
        currentSellingPricePaise: null,
        availableQuantity: null,
      },
      {
        savedLookItemId: productLine,
        wardrobeObjectKey: null,
        productImageObjectKey: 'product.webp',
        currentSellingPricePaise: 129900,
        availableQuantity: 3,
      },
    ]);
  }
  public createSignedImageUrl(): Promise<string> {
    return Promise.resolve('https://private.example/item');
  }
  public createPublicProductImageUrl(key: string): string {
    return `https://public.example/${key}`;
  }
  public removeObject(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SavedLookResolutionService', () => {
  it('hydrates mixed looks without persisting a snapshot', async () => {
    const result = await new SavedLookResolutionService(new Gateway()).resolve(actor, look);
    expect(result.items[0]?.imageUrl).toBe('https://private.example/item');
    expect(result.items[1]).toMatchObject({
      currentSellingPricePaise: 129900,
      availableQuantity: 3,
      imageUrl: 'https://public.example/product.webp',
    });
  });
});
