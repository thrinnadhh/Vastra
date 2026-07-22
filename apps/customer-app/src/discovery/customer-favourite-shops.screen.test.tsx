import { fireEvent, render } from '@testing-library/react-native';

import { CustomerFavouriteShopsScreen } from './customer-favourite-shops.screen';
import type { CustomerFavouriteState } from './customer-favourite.types';

const shop = {
  id: 'shop-id',
  name: 'Tirupati Trends',
  slug: 'tirupati-trends',
  logoObjectKey: null,
  coverImageObjectKey: null,
  operationalStatus: 'OPEN',
  acceptsOnlineOrders: true,
  ratingAverage: 4.5,
  ratingCount: 18,
  followerCount: 120,
  favouritedAt: '2026-07-22T04:00:00.000Z',
};

function state(overrides: Partial<CustomerFavouriteState> = {}): CustomerFavouriteState {
  return {
    shops: [shop],
    isLoading: false,
    isStale: false,
    failureKind: null,
    pendingShopIds: new Set<string>(),
    statusMessage: null,
    ...overrides,
  };
}

describe('CustomerFavouriteShopsScreen', () => {
  it('renders authoritative favourite facts and removes by shop id', () => {
    const onRemove = jest.fn();
    const screen = render(
      <CustomerFavouriteShopsScreen
        onBrowseShops={jest.fn()}
        onRefresh={jest.fn()}
        onRemove={onRemove}
        state={state()}
      />,
    );

    expect(screen.getByText('Tirupati Trends')).toBeTruthy();
    expect(screen.getByText('4.5 from 18 ratings')).toBeTruthy();
    expect(screen.getByText('120 followers')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Remove Tirupati Trends from favourites' }));
    expect(onRemove).toHaveBeenCalledWith('shop-id');
  });

  it('keeps visible shops with explicit stale and partial-failure messaging', () => {
    const screen = render(
      <CustomerFavouriteShopsScreen
        onBrowseShops={jest.fn()}
        onRefresh={jest.fn()}
        onRemove={jest.fn()}
        state={state({
          isStale: true,
          failureKind: 'OFFLINE',
          statusMessage: 'The favourite change was not saved.',
        })}
      />,
    );

    expect(
      screen.getByText('Showing the last successful favourite list because the latest refresh failed.'),
    ).toBeTruthy();
    expect(screen.getByText('You are offline. Reconnect to refresh favourite shops.')).toBeTruthy();
    expect(screen.getByText('The favourite change was not saved.')).toBeTruthy();
    expect(screen.getByText('Tirupati Trends')).toBeTruthy();
  });

  it('provides an empty-state path back to nearby shops', () => {
    const onBrowseShops = jest.fn();
    const screen = render(
      <CustomerFavouriteShopsScreen
        onBrowseShops={onBrowseShops}
        onRefresh={jest.fn()}
        onRemove={jest.fn()}
        state={state({ shops: [] })}
      />,
    );

    expect(screen.getByText('No favourite shops yet')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Browse nearby shops from favourites' }));
    expect(onBrowseShops).toHaveBeenCalledTimes(1);
  });

  it('disables duplicate removal while a shop mutation is pending', () => {
    const screen = render(
      <CustomerFavouriteShopsScreen
        onBrowseShops={jest.fn()}
        onRefresh={jest.fn()}
        onRemove={jest.fn()}
        state={state({ pendingShopIds: new Set(['shop-id']) })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove Tirupati Trends from favourites' })).toBeDisabled();
    expect(screen.getByText('Removing…')).toBeTruthy();
  });
});
