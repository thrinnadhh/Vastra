import { fireEvent, render } from '@testing-library/react-native';

import { CustomerProductScreen } from './customer-product.screen';
import type {
  CustomerAddToCartResult,
  CustomerProductDetail,
  CustomerProductDetailResult,
  CustomerProductPort,
} from './customer-product.types';

const product: CustomerProductDetail = {
  id: 'product-id',
  shopId: 'shop-id',
  categoryId: 'category-id',
  name: 'Blue cotton shirt',
  slug: 'blue-cotton-shirt',
  brand: 'Local Loom',
  gender: 'MEN',
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
      id: 'image-primary',
      imageType: 'PRODUCT',
      altText: 'Front view',
      displayOrder: 0,
      isPrimary: true,
      imageUrl: 'https://images.example.test/front.jpg',
      thumbnailUrl: null,
    },
  ],
  variants: [
    {
      id: 'variant-m',
      sku: 'SHIRT-BLUE-M',
      colourName: 'Blue',
      colourHex: '#0000FF',
      sizeLabel: 'M',
      mrpPaise: 99900,
      sellingPricePaise: 79900,
      attributes: {},
      availableQuantity: 3,
      isAvailable: true,
    },
    {
      id: 'variant-l',
      sku: 'SHIRT-BLUE-L',
      colourName: 'Blue',
      colourHex: '#0000FF',
      sizeLabel: 'L',
      mrpPaise: 99900,
      sellingPricePaise: 79900,
      attributes: {},
      availableQuantity: 0,
      isAvailable: false,
    },
  ],
};

class ProductPortStub implements CustomerProductPort {
  public readonly detailCalls: string[] = [];
  public readonly cartCalls: {
    readonly variantId: string;
    readonly quantity: number;
    readonly replaceExistingCart: boolean;
  }[] = [];

  public constructor(
    private readonly details: CustomerProductDetailResult[],
    private readonly cartResults: CustomerAddToCartResult[],
  ) {}

  public getProduct(productId: string): Promise<CustomerProductDetailResult> {
    this.detailCalls.push(productId);
    return Promise.resolve(this.details.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }

  public addToCart(
    variantId: string,
    quantity: number,
    replaceExistingCart: boolean,
  ): Promise<CustomerAddToCartResult> {
    this.cartCalls.push({ variantId, quantity, replaceExistingCart });
    return Promise.resolve(this.cartResults.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }
}

describe('CustomerProductScreen', () => {
  it('renders authoritative product, variant, shop, return, and size-contract information', async () => {
    const screen = render(
      <CustomerProductScreen
        onBack={jest.fn()}
        productId="product-id"
        productPort={new ProductPortStub([{ kind: 'SUCCESS', product }], [])}
      />,
    );

    expect(await screen.findByText('Blue cotton shirt')).toBeTruthy();
    expect(screen.getByText('Sold by Tirupati Trends')).toBeTruthy();
    expect(screen.getByText('M · Blue')).toBeTruthy();
    expect(screen.getByText('3 in stock')).toBeTruthy();
    expect(screen.getByText('Eligible within 7 days')).toBeTruthy();
    expect(
      screen.getByText(
        'Available size labels are shown on each variant. A measurement-based size chart is not present in the current catalogue contract.',
      ),
    ).toBeTruthy();
  });

  it('adds the selected live variant with the chosen quantity and refreshes stock', async () => {
    const availableVariant = product.variants[0];
    const unavailableVariant = product.variants[1];
    if (availableVariant === undefined || unavailableVariant === undefined) {
      throw new Error('Product variant fixtures are incomplete');
    }

    const port = new ProductPortStub(
      [
        { kind: 'SUCCESS', product },
        {
          kind: 'SUCCESS',
          product: {
            ...product,
            variants: [{ ...availableVariant, availableQuantity: 1 }, unavailableVariant],
          },
        },
      ],
      [{ kind: 'SUCCESS', cartItemCount: 2, cartShopId: 'shop-id' }],
    );
    const screen = render(
      <CustomerProductScreen onBack={jest.fn()} productId="product-id" productPort={port} />,
    );

    await screen.findByText('Blue cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add selected variant to cart' }));

    expect(await screen.findByText('Added to cart. Your cart now contains 2 items.')).toBeTruthy();
    expect(port.cartCalls).toEqual([
      { variantId: 'variant-m', quantity: 2, replaceExistingCart: false },
    ]);
    expect(port.detailCalls).toEqual(['product-id', 'product-id']);
    expect(await screen.findByText('1 in stock')).toBeTruthy();
  });

  it('requires explicit confirmation before replacing another-shop cart', async () => {
    const port = new ProductPortStub(
      [
        { kind: 'SUCCESS', product },
        { kind: 'SUCCESS', product },
      ],
      [
        { kind: 'FAILURE', failureKind: 'CART_CONFLICT' },
        { kind: 'SUCCESS', cartItemCount: 1, cartShopId: 'shop-id' },
      ],
    );
    const screen = render(
      <CustomerProductScreen onBack={jest.fn()} productId="product-id" productPort={port} />,
    );

    await screen.findByText('Blue cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Add selected variant to cart' }));
    expect(await screen.findByText('Replace the existing cart?')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Replace cart and add selected variant' }));

    expect(await screen.findByText('Added to cart. Your cart now contains 1 item.')).toBeTruthy();
    expect(port.cartCalls).toEqual([
      { variantId: 'variant-m', quantity: 1, replaceExistingCart: false },
      { variantId: 'variant-m', quantity: 1, replaceExistingCart: true },
    ]);
  });

  it('never allows an unavailable variant to become the cart selection', async () => {
    const soldOutProduct: CustomerProductDetail = {
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        availableQuantity: 0,
        isAvailable: false,
      })),
    };
    const port = new ProductPortStub([{ kind: 'SUCCESS', product: soldOutProduct }], []);
    const screen = render(
      <CustomerProductScreen onBack={jest.fn()} productId="product-id" productPort={port} />,
    );

    await screen.findByText('Blue cotton shirt');
    expect(screen.getByRole('button', { name: 'Add selected variant to cart' })).toBeDisabled();
    fireEvent.press(screen.getByTestId('product-variant-variant-l'));
    expect(port.cartCalls).toHaveLength(0);
  });

  it('keeps prior details visible with a stale warning after refresh failure', async () => {
    const port = new ProductPortStub(
      [
        { kind: 'SUCCESS', product },
        { kind: 'FAILURE', failureKind: 'OFFLINE' },
      ],
      [],
    );
    const screen = render(
      <CustomerProductScreen onBack={jest.fn()} productId="product-id" productPort={port} />,
    );

    await screen.findByText('Blue cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Refresh product price and stock' }));

    expect(
      await screen.findByText(
        'Showing the last successful product details. Price or stock refresh failed.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Blue cotton shirt')).toBeTruthy();
  });
});
