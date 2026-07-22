import { useState } from 'react';

import { fireEvent, render } from '@testing-library/react-native';

import { CustomerHomeScreen } from './customer-home.screen';
import type {
  CustomerHomeContent,
  CustomerHomeLoadResult,
  CustomerHomePort,
} from './customer-home.types';
import { CustomerProductScreen } from './customer-product.screen';
import type {
  CustomerAddToCartResult,
  CustomerProductDetail,
  CustomerProductDetailResult,
  CustomerProductPort,
} from './customer-product.types';
import { CustomerSearchScreen } from './customer-search.screen';
import {
  createInitialCustomerSearchSessionState,
  DEFAULT_CUSTOMER_SEARCH_FILTERS,
  type CustomerSearchPort,
  type CustomerSearchRequest,
  type CustomerSearchResult,
} from './customer-search.types';
import { CustomerShopsScreen } from './customer-shops.screen';
import type {
  CustomerNearbyShopsResult,
  CustomerShopDetailResult,
  CustomerShopPort,
  CustomerShopProductsResult,
} from './customer-shop.types';

const LOCATION = { latitude: 13.6288, longitude: 79.4192 } as const;
const SHOP_ID = '50000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '70000000-0000-4000-8000-000000000001';
const SECOND_PRODUCT_ID = '70000000-0000-4000-8000-000000000002';
const VARIANT_ID = '80000000-0000-4000-8000-000000000001';

const HOME_CONTENT: CustomerHomeContent = {
  location: LOCATION,
  categories: [{ id: 'category-id', name: 'Western wear', description: 'Everyday styles' }],
  nearbyShops: [
    {
      id: SHOP_ID,
      name: 'Journey Trends',
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
      distanceMeters: 700,
      minimumOrderPaise: 29900,
      averagePreparationMinutes: 20,
    },
  ],
  nearbyProducts: [
    {
      id: PRODUCT_ID,
      shopId: SHOP_ID,
      shopName: 'Journey Trends',
      name: 'Journey cotton shirt',
      brand: 'Local Loom',
      genderCategory: 'MEN',
      primaryImageUrl: null,
      primaryImageAlt: null,
      minimumSellingPricePaise: 79900,
      maximumSellingPricePaise: 79900,
      availableVariantCount: 1,
      totalAvailableQuantity: 3,
      isAvailable: true,
    },
  ],
};

const PRODUCT_DETAIL: CustomerProductDetail = {
  id: PRODUCT_ID,
  shopId: SHOP_ID,
  categoryId: 'category-id',
  name: 'Journey cotton shirt',
  slug: 'journey-cotton-shirt',
  brand: 'Local Loom',
  gender: 'MEN',
  shop: {
    id: SHOP_ID,
    name: 'Journey Trends',
    slug: 'journey-trends',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
  },
  description: 'A deterministic journey product.',
  material: 'Cotton',
  styleTags: ['casual'],
  occasionTags: ['daily'],
  careInstructions: 'Machine wash cold.',
  returnEligible: true,
  returnWindowDays: 7,
  images: [],
  variants: [
    {
      id: VARIANT_ID,
      sku: 'JOURNEY-M',
      colourName: 'Blue',
      colourHex: '#0000FF',
      sizeLabel: 'M',
      mrpPaise: 99900,
      sellingPricePaise: 79900,
      attributes: {},
      availableQuantity: 3,
      isAvailable: true,
    },
  ],
};

class HomePortStub implements CustomerHomePort {
  public loadHome(): Promise<CustomerHomeLoadResult> {
    return Promise.resolve({ kind: 'SUCCESS', content: HOME_CONTENT });
  }
}

class ShopPortStub implements CustomerShopPort {
  public readonly productRequests: { readonly cursor: string | null; readonly limit: number }[] =
    [];

  public listNearby(): Promise<CustomerNearbyShopsResult> {
    return Promise.resolve({
      kind: 'SUCCESS',
      location: LOCATION,
      shops: [
        {
          id: SHOP_ID,
          name: 'Journey Trends',
          slug: 'journey-trends',
          description: 'Journey shop',
          operationalStatus: 'OPEN',
          acceptsOnlineOrders: true,
          distanceMeters: 700,
          serviceRadiusMeters: 5000,
          minimumOrderPaise: 29900,
          averagePreparationMinutes: 20,
          ratingAverage: 4.7,
          ratingCount: 40,
          followerCount: 300,
        },
      ],
    });
  }

  public getDetail(): Promise<CustomerShopDetailResult> {
    return Promise.resolve({
      kind: 'SUCCESS',
      shop: {
        id: SHOP_ID,
        name: 'Journey Trends',
        slug: 'journey-trends',
        description: 'Journey shop',
        phoneNumber: '+919999999999',
        email: null,
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        orderingStatus: 'ACCEPTING_ORDERS',
        canPlaceOrder: true,
        distanceMeters: 700,
        serviceRadiusMeters: 5000,
        isServiceable: true,
        todayHours: {
          date: '2026-07-22',
          timeZone: 'Asia/Kolkata',
          source: 'WEEKLY',
          isClosed: false,
          opensAt: '10:00',
          closesAt: '21:00',
          isOpenNow: true,
        },
        minimumOrderPaise: 29900,
        averagePreparationMinutes: 20,
        ratingAverage: 4.7,
        ratingCount: 40,
        followerCount: 300,
      },
    });
  }

  public listProducts(
    _shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerShopProductsResult> {
    this.productRequests.push({ cursor, limit });
    return Promise.resolve({
      kind: 'SUCCESS',
      products: [
        {
          id: PRODUCT_ID,
          shopId: SHOP_ID,
          categoryId: 'category-id',
          name: 'Journey cotton shirt',
          brand: 'Local Loom',
          gender: 'MEN',
          imageUrl: null,
          imageAlt: null,
          minimumSellingPricePaise: 79900,
          maximumSellingPricePaise: 79900,
          availableVariantCount: 1,
          totalAvailableQuantity: 3,
          isAvailable: true,
        },
      ],
      nextCursor: null,
    });
  }
}

class ProductPortStub implements CustomerProductPort {
  public readonly cartCalls: {
    readonly variantId: string;
    readonly quantity: number;
    readonly replaceExistingCart: boolean;
  }[] = [];

  public getProduct(productId: string): Promise<CustomerProductDetailResult> {
    return Promise.resolve({
      kind: 'SUCCESS',
      product: { ...PRODUCT_DETAIL, id: productId },
    });
  }

  public addToCart(
    variantId: string,
    quantity: number,
    replaceExistingCart: boolean,
  ): Promise<CustomerAddToCartResult> {
    this.cartCalls.push({ variantId, quantity, replaceExistingCart });
    return Promise.resolve({ kind: 'SUCCESS', cartItemCount: 1, cartShopId: SHOP_ID });
  }
}

class SearchPortStub implements CustomerSearchPort {
  public readonly requests: CustomerSearchRequest[] = [];

  public search(request: CustomerSearchRequest): Promise<CustomerSearchResult> {
    this.requests.push(request);
    if (request.cursor === null) {
      return Promise.resolve({
        kind: 'SUCCESS',
        page: {
          normalizedQuery: request.query,
          filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
          results: [
            {
              id: PRODUCT_ID,
              shopId: SHOP_ID,
              shopName: 'Journey Trends',
              shopOperationalStatus: 'OPEN',
              shopAcceptsOnlineOrders: true,
              distanceMeters: 700,
              categoryId: 'category-id',
              name: 'Journey cotton shirt',
              brand: 'Local Loom',
              gender: 'MEN',
              imageUrl: null,
              imageAlt: null,
              minimumSellingPricePaise: 79900,
              maximumSellingPricePaise: 79900,
              availableVariantCount: 1,
              totalAvailableQuantity: 3,
              isAvailable: true,
            },
          ],
          nextCursor: 'opaque-page-2',
        },
      });
    }

    return Promise.resolve({
      kind: 'SUCCESS',
      page: {
        normalizedQuery: request.query,
        filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
        results: [
          {
            id: PRODUCT_ID,
            shopId: SHOP_ID,
            shopName: 'Journey Trends',
            shopOperationalStatus: 'OPEN',
            shopAcceptsOnlineOrders: true,
            distanceMeters: 700,
            categoryId: 'category-id',
            name: 'Journey cotton shirt',
            brand: 'Local Loom',
            gender: 'MEN',
            imageUrl: null,
            imageAlt: null,
            minimumSellingPricePaise: 79900,
            maximumSellingPricePaise: 79900,
            availableVariantCount: 1,
            totalAvailableQuantity: 3,
            isAvailable: true,
          },
          {
            id: SECOND_PRODUCT_ID,
            shopId: SHOP_ID,
            shopName: 'Journey Trends',
            shopOperationalStatus: 'OPEN',
            shopAcceptsOnlineOrders: true,
            distanceMeters: 700,
            categoryId: 'category-id',
            name: 'Journey white shirt',
            brand: 'Local Loom',
            gender: 'MEN',
            imageUrl: null,
            imageAlt: null,
            minimumSellingPricePaise: 89900,
            maximumSellingPricePaise: 89900,
            availableVariantCount: 1,
            totalAvailableQuantity: 2,
            isAvailable: true,
          },
        ],
        nextCursor: null,
      },
    });
  }
}

function HomeShopProductJourney({
  homePort,
  shopPort,
  productPort,
}: {
  readonly homePort: CustomerHomePort;
  readonly shopPort: CustomerShopPort;
  readonly productPort: CustomerProductPort;
}) {
  const [route, setRoute] = useState<
    | { readonly kind: 'HOME' }
    | { readonly kind: 'SHOP'; readonly shopId: string }
    | { readonly kind: 'PRODUCT'; readonly productId: string }
  >({ kind: 'HOME' });

  if (route.kind === 'PRODUCT') {
    return (
      <CustomerProductScreen
        onBack={() => {
          setRoute({ kind: 'SHOP', shopId: SHOP_ID });
        }}
        productId={route.productId}
        productPort={productPort}
      />
    );
  }

  if (route.kind === 'SHOP') {
    return (
      <CustomerShopsScreen
        initialShopId={route.shopId}
        location={LOCATION}
        onInitialShopConsumed={jest.fn()}
        onRequestLocation={jest.fn()}
        onSelectProduct={(productId) => {
          setRoute({ kind: 'PRODUCT', productId });
        }}
        shopPort={shopPort}
      />
    );
  }

  return (
    <CustomerHomeScreen
      coordinates={LOCATION}
      homePort={homePort}
      onChangeLocation={jest.fn()}
      onOpenCheckout={jest.fn()}
      onSearch={jest.fn()}
      onSelectCategory={jest.fn()}
      onSelectProduct={(productId) => {
        setRoute({ kind: 'PRODUCT', productId });
      }}
      onSelectShop={(shopId) => {
        setRoute({ kind: 'SHOP', shopId });
      }}
    />
  );
}

function SearchProductJourney({
  searchPort,
  productPort,
}: {
  readonly searchPort: CustomerSearchPort;
  readonly productPort: CustomerProductPort;
}) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState(createInitialCustomerSearchSessionState);

  if (selectedProductId !== null) {
    return (
      <CustomerProductScreen
        onBack={() => {
          setSelectedProductId(null);
        }}
        productId={selectedProductId}
        productPort={productPort}
      />
    );
  }

  return (
    <CustomerSearchScreen
      location={LOCATION}
      onRequestLocation={jest.fn()}
      onSelectProduct={setSelectedProductId}
      searchPort={searchPort}
      sessionState={sessionState}
      setSessionState={setSessionState}
    />
  );
}

describe('customer discovery journeys', () => {
  it('completes Home to exact shop to product to a valid cart selection', async () => {
    const shopPort = new ShopPortStub();
    const productPort = new ProductPortStub();
    const screen = render(
      <HomeShopProductJourney
        homePort={new HomePortStub()}
        productPort={productPort}
        shopPort={shopPort}
      />,
    );

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Open Journey Trends. 700 m away. Open for online orders',
      }),
    );
    expect(await screen.findByText('Shop catalogue')).toBeTruthy();
    expect(screen.getByText('Open now · 10:00–21:00')).toBeTruthy();
    expect(shopPort.productRequests).toEqual([{ cursor: null, limit: 20 }]);

    fireEvent.press(screen.getByTestId(`shop-product-${PRODUCT_ID}`));
    expect(await screen.findByRole('header', { name: 'Journey cotton shirt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'M · Blue, 3 available' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add selected variant to cart' }));

    expect(await screen.findByText('Added to cart. Your cart now contains 1 item.')).toBeTruthy();
    expect(productPort.cartCalls).toEqual([
      { variantId: VARIANT_ID, quantity: 1, replaceExistingCart: false },
    ]);
  });

  it('paginates search with an opaque cursor, deduplicates, and opens the selected product', async () => {
    const searchPort = new SearchPortStub();
    const screen = render(
      <SearchProductJourney productPort={new ProductPortStub()} searchPort={searchPort} />,
    );

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(await screen.findByText('Journey cotton shirt')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Load more search results' }));

    expect(await screen.findByText('Journey white shirt')).toBeTruthy();
    expect(screen.getAllByText('Journey cotton shirt')).toHaveLength(1);
    expect(screen.getByText('2 products loaded')).toBeTruthy();
    expect(searchPort.requests.map((request) => request.cursor)).toEqual([null, 'opaque-page-2']);
    expect(searchPort.requests.every((request) => request.limit === 20)).toBe(true);

    fireEvent.press(screen.getByTestId(`search-product-${SECOND_PRODUCT_ID}`));
    expect(await screen.findByRole('header', { name: 'Journey cotton shirt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to discovery' })).toBeTruthy();
  });
});
