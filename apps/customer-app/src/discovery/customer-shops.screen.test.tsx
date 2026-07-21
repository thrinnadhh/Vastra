import { fireEvent, render } from '@testing-library/react-native';

import { CustomerShopsScreen } from './customer-shops.screen';
import type {
  CustomerNearbyShopsResult,
  CustomerShopDetailResult,
  CustomerShopPort,
  CustomerShopProductsResult,
} from './customer-shop.types';

const location = { latitude: 13.6288, longitude: 79.4192 };

const nearbyShop = {
  id: 'shop-id',
  name: 'Tirupati Trends',
  slug: 'tirupati-trends',
  description: 'Local fashion shop',
  operationalStatus: 'OPEN',
  acceptsOnlineOrders: true,
  distanceMeters: 850,
  serviceRadiusMeters: 5000,
  minimumOrderPaise: 29900,
  averagePreparationMinutes: 20,
  ratingAverage: 4.5,
  ratingCount: 18,
  followerCount: 120,
};

const detail = {
  id: 'shop-id',
  name: 'Tirupati Trends',
  slug: 'tirupati-trends',
  description: 'Local fashion shop',
  phoneNumber: '+919999999999',
  email: 'shop@example.test',
  operationalStatus: 'OPEN',
  acceptsOnlineOrders: true,
  orderingStatus: 'ACCEPTING_ORDERS' as const,
  canPlaceOrder: true,
  distanceMeters: 850,
  serviceRadiusMeters: 5000,
  isServiceable: true,
  todayHours: {
    date: '2026-07-22',
    timeZone: 'Asia/Kolkata' as const,
    source: 'WEEKLY' as const,
    isClosed: false,
    opensAt: '10:00',
    closesAt: '21:00',
    isOpenNow: true,
  },
  minimumOrderPaise: 29900,
  averagePreparationMinutes: 20,
  ratingAverage: 4.5,
  ratingCount: 18,
  followerCount: 120,
};

const product = {
  id: 'product-id',
  shopId: 'shop-id',
  categoryId: 'category-id',
  name: 'Blue cotton shirt',
  brand: 'Local Loom',
  gender: 'MEN' as const,
  imageUrl: null,
  imageAlt: null,
  minimumSellingPricePaise: 79900,
  maximumSellingPricePaise: 99900,
  availableVariantCount: 3,
  totalAvailableQuantity: 8,
  isAvailable: true,
};

class ShopPortStub implements CustomerShopPort {
  public readonly nearbyCalls: { readonly location: typeof location; readonly limit: number }[] =
    [];
  public readonly detailCalls: { readonly shopId: string; readonly location: typeof location }[] =
    [];
  public readonly productCalls: {
    readonly shopId: string;
    readonly cursor: string | null;
    readonly limit: number;
  }[] = [];

  public constructor(
    private readonly nearbyResults: CustomerNearbyShopsResult[],
    private readonly detailResults: CustomerShopDetailResult[],
    private readonly productResults: CustomerShopProductsResult[],
  ) {}

  public listNearby(
    requestedLocation: typeof location,
    limit: number,
  ): Promise<CustomerNearbyShopsResult> {
    this.nearbyCalls.push({ location: requestedLocation, limit });
    return Promise.resolve(this.nearbyResults.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }

  public getDetail(
    shopId: string,
    requestedLocation: typeof location,
  ): Promise<CustomerShopDetailResult> {
    this.detailCalls.push({ shopId, location: requestedLocation });
    return Promise.resolve(this.detailResults.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }

  public listProducts(
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerShopProductsResult> {
    this.productCalls.push({ shopId, cursor, limit });
    return Promise.resolve(
      this.productResults.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' },
    );
  }
}

describe('CustomerShopsScreen', () => {
  it('requires a confirmed shopping location', () => {
    const onRequestLocation = jest.fn();
    const screen = render(
      <CustomerShopsScreen
        location={null}
        onRequestLocation={onRequestLocation}
        onSelectProduct={jest.fn()}
        shopPort={new ShopPortStub([], [], [])}
      />,
    );

    expect(screen.getByText('Set a shopping location first')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Set nearby shop location' }));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);
  });

  it('loads nearby shops and opens authoritative shop details and catalogue', async () => {
    const shopPort = new ShopPortStub(
      [{ kind: 'SUCCESS', location, shops: [nearbyShop] }],
      [{ kind: 'SUCCESS', shop: detail }],
      [{ kind: 'SUCCESS', products: [product], nextCursor: null }],
    );
    const onSelectProduct = jest.fn();
    const screen = render(
      <CustomerShopsScreen
        location={location}
        onRequestLocation={jest.fn()}
        onSelectProduct={onSelectProduct}
        shopPort={shopPort}
      />,
    );

    expect(await screen.findByTestId('nearby-shop-shop-id')).toBeTruthy();
    expect(screen.getByText('4.5 from 18 ratings')).toBeTruthy();
    fireEvent.press(screen.getByTestId('nearby-shop-shop-id'));

    expect(await screen.findByText('Accepting online orders')).toBeTruthy();
    expect(screen.getByText('Open now · 10:00–21:00')).toBeTruthy();
    expect(screen.getByText('Blue cotton shirt')).toBeTruthy();
    expect(shopPort.detailCalls).toEqual([{ shopId: 'shop-id', location }]);
    expect(shopPort.productCalls[0]).toEqual({ shopId: 'shop-id', cursor: null, limit: 20 });

    fireEvent.press(screen.getByTestId('shop-product-product-id'));
    expect(onSelectProduct).toHaveBeenCalledWith('product-id');
  });

  it('appends cursor catalogue pages without duplicate product ids', async () => {
    const nextProduct = { ...product, id: 'product-id-2', name: 'White cotton shirt' };
    const shopPort = new ShopPortStub(
      [{ kind: 'SUCCESS', location, shops: [nearbyShop] }],
      [{ kind: 'SUCCESS', shop: detail }],
      [
        { kind: 'SUCCESS', products: [product], nextCursor: 'next-page' },
        { kind: 'SUCCESS', products: [product, nextProduct], nextCursor: null },
      ],
    );
    const screen = render(
      <CustomerShopsScreen
        location={location}
        onRequestLocation={jest.fn()}
        onSelectProduct={jest.fn()}
        shopPort={shopPort}
      />,
    );

    fireEvent.press(await screen.findByTestId('nearby-shop-shop-id'));
    expect(await screen.findByRole('button', { name: 'Load more shop products' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Load more shop products' }));

    expect(await screen.findByText('White cotton shirt')).toBeTruthy();
    expect(screen.getAllByText('Blue cotton shirt')).toHaveLength(1);
    expect(screen.getByText('2 products loaded')).toBeTruthy();
    expect(shopPort.productCalls[1]).toEqual({
      shopId: 'shop-id',
      cursor: 'next-page',
      limit: 20,
    });
  });

  it('does not open an unavailable shop product', async () => {
    const unavailable = {
      ...product,
      id: 'unavailable-product-id',
      name: 'Sold-out shirt',
      availableVariantCount: 0,
      totalAvailableQuantity: 0,
      isAvailable: false,
    };
    const shopPort = new ShopPortStub(
      [{ kind: 'SUCCESS', location, shops: [nearbyShop] }],
      [{ kind: 'SUCCESS', shop: detail }],
      [{ kind: 'SUCCESS', products: [unavailable], nextCursor: null }],
    );
    const onSelectProduct = jest.fn();
    const screen = render(
      <CustomerShopsScreen
        location={location}
        onRequestLocation={jest.fn()}
        onSelectProduct={onSelectProduct}
        shopPort={shopPort}
      />,
    );

    fireEvent.press(await screen.findByTestId('nearby-shop-shop-id'));
    expect(await screen.findByText('Sold-out shirt')).toBeTruthy();
    fireEvent.press(screen.getByTestId('shop-product-unavailable-product-id'));
    expect(onSelectProduct).not.toHaveBeenCalled();
  });

  it('shows a truthful empty-area recovery', async () => {
    const onRequestLocation = jest.fn();
    const screen = render(
      <CustomerShopsScreen
        location={location}
        onRequestLocation={onRequestLocation}
        onSelectProduct={jest.fn()}
        shopPort={new ShopPortStub([{ kind: 'SUCCESS', location, shops: [] }], [], [])}
      />,
    );

    expect(await screen.findByText('No serviceable shops nearby')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Change nearby shop location' }));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);
  });
});
