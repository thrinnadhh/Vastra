import { fireEvent, render } from '@testing-library/react-native';

import { CustomerHomeScreen } from './customer-home.screen';
import type {
  CustomerHomeContent,
  CustomerHomeLoadResult,
  CustomerHomePort,
} from './customer-home.types';

const content: CustomerHomeContent = {
  location: { latitude: 13.6288, longitude: 79.4192 },
  categories: [
    { id: 'category-id', name: 'Western wear', description: 'Modern everyday clothing' },
  ],
  nearbyShops: [
    {
      id: 'shop-id',
      name: 'Tirupati Trends',
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
      distanceMeters: 850,
      minimumOrderPaise: 29900,
      averagePreparationMinutes: 20,
    },
  ],
  nearbyProducts: [
    {
      id: 'available-product-id',
      shopId: 'shop-id',
      shopName: 'Tirupati Trends',
      name: 'Blue cotton shirt',
      brand: 'Local Loom',
      genderCategory: 'MEN',
      primaryImageUrl: null,
      primaryImageAlt: null,
      minimumSellingPricePaise: 79900,
      maximumSellingPricePaise: 99900,
      availableVariantCount: 3,
      totalAvailableQuantity: 8,
      isAvailable: true,
    },
    {
      id: 'unavailable-product-id',
      shopId: 'shop-id',
      shopName: 'Tirupati Trends',
      name: 'Sold-out linen shirt',
      brand: null,
      genderCategory: 'MEN',
      primaryImageUrl: null,
      primaryImageAlt: null,
      minimumSellingPricePaise: 69900,
      maximumSellingPricePaise: 69900,
      availableVariantCount: 0,
      totalAvailableQuantity: 0,
      isAvailable: false,
    },
  ],
};

class HomePortStub implements CustomerHomePort {
  public readonly coordinates: { readonly latitude: number; readonly longitude: number }[] = [];

  public constructor(private readonly results: CustomerHomeLoadResult[]) {}

  public loadHome(coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  }): Promise<CustomerHomeLoadResult> {
    this.coordinates.push(coordinates);
    return Promise.resolve(this.results.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }
}

function renderHome(homePort: CustomerHomePort) {
  const onChangeLocation = jest.fn();
  const onSearch = jest.fn();
  const onSelectCategory = jest.fn();
  const onSelectShop = jest.fn();
  const onSelectProduct = jest.fn();
  const onOpenCheckout = jest.fn();
  const result = render(
    <CustomerHomeScreen
      coordinates={{ latitude: 13.6288, longitude: 79.4192 }}
      homePort={homePort}
      onChangeLocation={onChangeLocation}
      onOpenCheckout={onOpenCheckout}
      onSearch={onSearch}
      onSelectCategory={onSelectCategory}
      onSelectProduct={onSelectProduct}
      onSelectShop={onSelectShop}
    />,
  );

  return {
    ...result,
    onChangeLocation,
    onSearch,
    onSelectCategory,
    onSelectShop,
    onSelectProduct,
    onOpenCheckout,
  };
}

describe('CustomerHomeScreen', () => {
  it('renders server-backed local discovery and exposes its owned actions', async () => {
    const homePort = new HomePortStub([{ kind: 'SUCCESS', content }]);
    const screen = renderHome(homePort);

    expect(await screen.findByText('Find every kind of style from shops around you.')).toBeTruthy();
    expect(screen.getByText('Western wear')).toBeTruthy();
    expect(screen.getByTestId('home-shop-shop-id')).toBeTruthy();
    expect(screen.getByText('Blue cotton shirt')).toBeTruthy();
    expect(screen.getByText('₹799–₹999')).toBeTruthy();
    expect(homePort.coordinates).toEqual([{ latitude: 13.6288, longitude: 79.4192 }]);

    fireEvent.press(screen.getByRole('button', { name: 'Search local fashion' }));
    fireEvent.press(screen.getByRole('button', { name: 'Browse Western wear' }));
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Open Tirupati Trends. 850 m away. Open for online orders',
      }),
    );
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Blue cotton shirt from Tirupati Trends. ₹799–₹999. Available',
      }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue to checkout' }));

    expect(screen.onSearch).toHaveBeenCalledTimes(1);
    expect(screen.onSelectCategory).toHaveBeenCalledWith('category-id');
    expect(screen.onSelectShop).toHaveBeenCalledWith('shop-id');
    expect(screen.onSelectProduct).toHaveBeenCalledWith('available-product-id');
    expect(screen.onOpenCheckout).toHaveBeenCalledTimes(1);
  });

  it('does not open a product without a currently available variant', async () => {
    const screen = renderHome(new HomePortStub([{ kind: 'SUCCESS', content }]));

    expect(await screen.findByText('Sold-out linen shirt')).toBeTruthy();

    fireEvent.press(screen.getByTestId('home-product-unavailable-product-id'));
    expect(screen.onSelectProduct).not.toHaveBeenCalled();
  });

  it('shows truthful service-area recovery when Home has no nearby catalogue', async () => {
    const screen = renderHome(
      new HomePortStub([
        {
          kind: 'SUCCESS',
          content: { ...content, nearbyShops: [], nearbyProducts: [] },
        },
      ]),
    );

    expect(await screen.findByText('No serviceable shops here yet')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Change location' }));
    expect(screen.onChangeLocation).toHaveBeenCalledTimes(1);
  });

  it('recovers from an initial offline failure without displaying invented content', async () => {
    const homePort = new HomePortStub([
      { kind: 'FAILURE', failureKind: 'OFFLINE' },
      { kind: 'SUCCESS', content },
    ]);
    const screen = renderHome(homePort);

    expect(await screen.findByText('You are offline')).toBeTruthy();
    expect(screen.queryByTestId('home-shop-shop-id')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('home-shop-shop-id')).toBeTruthy();
  });

  it('preserves visible content and announces stale data when a coordinate refresh fails', async () => {
    const homePort = new HomePortStub([
      { kind: 'SUCCESS', content },
      { kind: 'FAILURE', failureKind: 'ERROR' },
    ]);
    const screen = renderHome(homePort);

    expect(await screen.findByTestId('home-shop-shop-id')).toBeTruthy();
    screen.rerender(
      <CustomerHomeScreen
        coordinates={{ latitude: 13.63, longitude: 79.42 }}
        homePort={homePort}
        onChangeLocation={screen.onChangeLocation}
        onOpenCheckout={screen.onOpenCheckout}
        onSearch={screen.onSearch}
        onSelectCategory={screen.onSelectCategory}
        onSelectProduct={screen.onSelectProduct}
        onSelectShop={screen.onSelectShop}
      />,
    );

    expect(await screen.findByText('STALE DATA')).toBeTruthy();
    expect(screen.getByTestId('home-shop-shop-id')).toBeTruthy();
  });
});