import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerProductAdapter } from './api-customer-product.adapter';

function createApiClient(request: jest.Mock): ApiClient {
  return { request };
}

const productPayload = {
  id: 'product-id',
  shopId: 'shop-id',
  categoryId: 'category-id',
  name: 'Blue cotton shirt',
  slug: 'blue-cotton-shirt',
  brand: 'Local Loom',
  genderCategory: 'MEN',
  shop: {
    id: 'shop-id',
    name: 'Tirupati Trends',
    slug: 'tirupati-trends',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
  },
  description: 'A breathable cotton shirt.',
  material: 'Cotton',
  styleTags: ['casual'],
  occasionTags: ['daily'],
  careInstructions: 'Machine wash cold.',
  returnEligible: true,
  returnWindowDays: 7,
  images: [
    {
      id: 'image-secondary',
      imageType: 'PRODUCT',
      altText: 'Back view',
      displayOrder: 1,
      isPrimary: false,
      imageUrl: 'https://images.example.test/back.jpg',
      thumbnailUrl: null,
    },
    {
      id: 'image-primary',
      imageType: 'PRODUCT',
      altText: 'Front view',
      displayOrder: 0,
      isPrimary: true,
      imageUrl: 'https://images.example.test/front.jpg',
      thumbnailUrl: 'https://images.example.test/front-thumb.jpg',
    },
  ],
  variants: [
    {
      id: 'variant-id',
      sku: 'SHIRT-BLUE-M',
      colourName: 'Blue',
      colourHex: '#0000FF',
      sizeLabel: 'M',
      mrpPaise: 99900,
      sellingPricePaise: 79900,
      attributes: {},
      availableQuantity: 4,
      isAvailable: true,
    },
  ],
};

describe('ApiCustomerProductAdapter', () => {
  it('maps product media, shop, returns, and live variants', async () => {
    const request = jest.fn().mockResolvedValue({ data: { data: { product: productPayload } } });
    const adapter = new ApiCustomerProductAdapter(createApiClient(request));

    await expect(adapter.getProduct('product-id')).resolves.toEqual({
      kind: 'SUCCESS',
      product: {
        id: 'product-id',
        shopId: 'shop-id',
        categoryId: 'category-id',
        name: 'Blue cotton shirt',
        slug: 'blue-cotton-shirt',
        brand: 'Local Loom',
        gender: 'MEN',
        shop: productPayload.shop,
        description: 'A breathable cotton shirt.',
        material: 'Cotton',
        styleTags: ['casual'],
        occasionTags: ['daily'],
        careInstructions: 'Machine wash cold.',
        returnEligible: true,
        returnWindowDays: 7,
        images: [productPayload.images[1], productPayload.images[0]],
        variants: productPayload.variants,
      },
    });
    expect(request).toHaveBeenCalledWith('getCustomerCatalogueProduct', {
      path: { productId: 'product-id' },
    });
  });

  it('adds a selected variant without replacing another-shop cart by default', async () => {
    const request = jest.fn().mockResolvedValue({
      data: { data: { cart: { shop: { id: 'shop-id' }, itemCount: 2 } } },
    });
    const adapter = new ApiCustomerProductAdapter(createApiClient(request));

    await expect(adapter.addToCart('variant-id', 2, false)).resolves.toEqual({
      kind: 'SUCCESS',
      cartItemCount: 2,
      cartShopId: 'shop-id',
    });
    expect(request).toHaveBeenCalledWith('setCustomerCartItem', {
      body: { variantId: 'variant-id', quantity: 2, replaceExistingCart: false },
    });
  });

  it('classifies cart conflicts, inventory changes, not-found, and offline failures', async () => {
    const conflict = new ApiCustomerProductAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { code: 'CART_SHOP_CONFLICT' } })),
    );
    const unavailable = new ApiCustomerProductAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { code: 'INSUFFICIENT_INVENTORY' } })),
    );
    const missing = new ApiCustomerProductAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { status: 404 } })),
    );
    const offline = new ApiCustomerProductAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { kind: 'TIMEOUT' } })),
    );

    await expect(conflict.addToCart('variant-id', 1, false)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'CART_CONFLICT',
    });
    await expect(unavailable.addToCart('variant-id', 1, false)).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'UNAVAILABLE',
    });
    await expect(missing.getProduct('product-id')).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'NOT_FOUND',
    });
    await expect(offline.getProduct('product-id')).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'OFFLINE',
    });
  });
});
