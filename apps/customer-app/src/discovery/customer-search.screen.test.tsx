import { useState } from 'react';

import { fireEvent, render } from '@testing-library/react-native';

import { CustomerSearchScreen } from './customer-search.screen';
import {
  createInitialCustomerSearchSessionState,
  DEFAULT_CUSTOMER_SEARCH_FILTERS,
  type CustomerSearchPage,
  type CustomerSearchPort,
  type CustomerSearchRequest,
  type CustomerSearchResult,
  type CustomerSearchSessionState,
} from './customer-search.types';

const location = { latitude: 13.6288, longitude: 79.4192 };

const product = {
  id: 'product-id',
  shopId: 'shop-id',
  shopName: 'Tirupati Trends',
  shopOperationalStatus: 'OPEN',
  shopAcceptsOnlineOrders: true,
  distanceMeters: 850,
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

function page(overrides: Partial<CustomerSearchPage> = {}): CustomerSearchPage {
  return {
    normalizedQuery: 'cotton shirt',
    filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
    results: [product],
    nextCursor: null,
    ...overrides,
  };
}

class SearchPortStub implements CustomerSearchPort {
  public readonly requests: CustomerSearchRequest[] = [];

  public constructor(private readonly results: CustomerSearchResult[]) {}

  public search(request: CustomerSearchRequest): Promise<CustomerSearchResult> {
    this.requests.push(request);
    return Promise.resolve(this.results.shift() ?? { kind: 'FAILURE', failureKind: 'ERROR' });
  }
}

function SearchHarness({
  searchPort,
  onSelectProduct = jest.fn(),
  initialState = createInitialCustomerSearchSessionState(),
  locationValue = location,
  onRequestLocation = jest.fn(),
}: {
  readonly searchPort: CustomerSearchPort;
  readonly onSelectProduct?: (productId: string) => void;
  readonly initialState?: CustomerSearchSessionState;
  readonly locationValue?: typeof location | null;
  readonly onRequestLocation?: () => void;
}) {
  const [sessionState, setSessionState] = useState(initialState);

  return (
    <CustomerSearchScreen
      location={locationValue}
      onRequestLocation={onRequestLocation}
      onSelectProduct={onSelectProduct}
      searchPort={searchPort}
      sessionState={sessionState}
      setSessionState={setSessionState}
    />
  );
}

describe('CustomerSearchScreen', () => {
  it('requires a confirmed shopping location', () => {
    const onRequestLocation = jest.fn();
    const screen = render(
      <SearchHarness
        locationValue={null}
        onRequestLocation={onRequestLocation}
        searchPort={new SearchPortStub([])}
      />,
    );

    expect(screen.getByText('Set a shopping location first')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Set search location' }));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);
  });

  it('validates, submits, renders server results, and records a session suggestion', async () => {
    const searchPort = new SearchPortStub([{ kind: 'SUCCESS', page: page() }]);
    const onSelectProduct = jest.fn();
    const screen = render(
      <SearchHarness onSelectProduct={onSelectProduct} searchPort={searchPort} />,
    );

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'a');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(screen.getByText('Enter between 2 and 100 characters.')).toBeTruthy();
    expect(searchPort.requests).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('customer-search-input'), '  cotton   shirt  ');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));

    expect(await screen.findByText('Blue cotton shirt')).toBeTruthy();
    expect(screen.getByText('₹799–₹999')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search again for cotton shirt' })).toBeTruthy();
    expect(searchPort.requests[0]).toEqual({
      query: 'cotton shirt',
      location,
      filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
      cursor: null,
      limit: 20,
    });

    fireEvent.press(screen.getByTestId('search-product-product-id'));
    expect(onSelectProduct).toHaveBeenCalledWith('product-id');
  });

  it('applies filters to the preserved submitted query', async () => {
    const searchPort = new SearchPortStub([
      { kind: 'SUCCESS', page: page() },
      {
        kind: 'SUCCESS',
        page: page({
          filters: { ...DEFAULT_CUSTOMER_SEARCH_FILTERS, gender: 'WOMEN' },
        }),
      },
    ]);
    const screen = render(<SearchHarness searchPort={searchPort} />);

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(await screen.findByText('Blue cotton shirt')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Show search filters' }));
    fireEvent.press(screen.getByRole('button', { name: 'Filter by Women' }));

    expect(searchPort.requests).toHaveLength(2);
    expect(searchPort.requests[1]).toEqual({
      query: 'cotton shirt',
      location,
      filters: { ...DEFAULT_CUSTOMER_SEARCH_FILTERS, gender: 'WOMEN' },
      cursor: null,
      limit: 20,
    });
  });

  it('appends cursor pages and deduplicates product ids', async () => {
    const secondProduct = { ...product, id: 'product-id-2', name: 'White cotton shirt' };
    const searchPort = new SearchPortStub([
      { kind: 'SUCCESS', page: page({ nextCursor: 'next-page' }) },
      {
        kind: 'SUCCESS',
        page: page({ results: [product, secondProduct], nextCursor: null }),
      },
    ]);
    const screen = render(<SearchHarness searchPort={searchPort} />);

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(await screen.findByRole('button', { name: 'Load more search results' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Load more search results' }));

    expect(await screen.findByText('White cotton shirt')).toBeTruthy();
    expect(screen.getAllByText('Blue cotton shirt')).toHaveLength(1);
    expect(screen.getByText('2 products loaded')).toBeTruthy();
    expect(searchPort.requests[1]?.cursor).toBe('next-page');
  });

  it('offers no-result recovery without dropping the query', async () => {
    const searchPort = new SearchPortStub([
      { kind: 'SUCCESS', page: page({ results: [] }) },
      { kind: 'SUCCESS', page: page({ results: [product] }) },
    ]);
    const screen = render(
      <SearchHarness
        initialState={{
          ...createInitialCustomerSearchSessionState(),
          filters: { ...DEFAULT_CUSTOMER_SEARCH_FILTERS, gender: 'MEN' },
        }}
        searchPort={searchPort}
      />,
    );

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(await screen.findByText('No matching products nearby')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear filters and retry search' }));

    expect(await screen.findByText('Blue cotton shirt')).toBeTruthy();
    expect(searchPort.requests[1]?.query).toBe('cotton shirt');
    expect(searchPort.requests[1]?.filters).toEqual(DEFAULT_CUSTOMER_SEARCH_FILTERS);
  });

  it('keeps previous results visible after a failed refresh', async () => {
    const searchPort = new SearchPortStub([
      { kind: 'SUCCESS', page: page() },
      { kind: 'FAILURE', failureKind: 'OFFLINE' },
    ]);
    const screen = render(<SearchHarness searchPort={searchPort} />);

    fireEvent.changeText(screen.getByTestId('customer-search-input'), 'cotton shirt');
    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));
    expect(await screen.findByText('Blue cotton shirt')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Submit product search' }));

    expect(await screen.findByText('Showing previous results')).toBeTruthy();
    expect(screen.getByText('Blue cotton shirt')).toBeTruthy();
  });
});
