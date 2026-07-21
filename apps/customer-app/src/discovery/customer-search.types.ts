import type { CustomerHomeCoordinates } from './customer-home.types';

export const CUSTOMER_SEARCH_SORTS = [
  'RELEVANCE',
  'DISTANCE',
  'PRICE_ASC',
  'PRICE_DESC',
] as const;
export type CustomerSearchSort = (typeof CUSTOMER_SEARCH_SORTS)[number];

export const CUSTOMER_SEARCH_GENDERS = ['MEN', 'WOMEN', 'KIDS', 'UNISEX'] as const;
export type CustomerSearchGender = (typeof CUSTOMER_SEARCH_GENDERS)[number];

export interface CustomerSearchFilters {
  readonly categoryId: string | null;
  readonly gender: CustomerSearchGender | null;
  readonly shopId: string | null;
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
  readonly availableOnly: boolean;
  readonly sort: CustomerSearchSort;
}

export const DEFAULT_CUSTOMER_SEARCH_FILTERS: CustomerSearchFilters = Object.freeze({
  categoryId: null,
  gender: null,
  shopId: null,
  minPricePaise: null,
  maxPricePaise: null,
  availableOnly: true,
  sort: 'RELEVANCE',
});

export interface CustomerSearchRequest {
  readonly query: string;
  readonly location: CustomerHomeCoordinates;
  readonly filters: CustomerSearchFilters;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface CustomerSearchItem {
  readonly id: string;
  readonly shopId: string;
  readonly shopName: string;
  readonly shopOperationalStatus: string;
  readonly shopAcceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly categoryId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly gender: CustomerSearchGender;
  readonly imageUrl: string | null;
  readonly imageAlt: string | null;
  readonly minimumSellingPricePaise: number | null;
  readonly maximumSellingPricePaise: number | null;
  readonly availableVariantCount: number;
  readonly totalAvailableQuantity: number;
  readonly isAvailable: boolean;
}

export interface CustomerSearchPage {
  readonly normalizedQuery: string;
  readonly filters: CustomerSearchFilters;
  readonly results: readonly CustomerSearchItem[];
  readonly nextCursor: string | null;
}

export type CustomerSearchFailureKind = 'OFFLINE' | 'ERROR';

export type CustomerSearchResult =
  | { readonly kind: 'SUCCESS'; readonly page: CustomerSearchPage }
  | { readonly kind: 'FAILURE'; readonly failureKind: CustomerSearchFailureKind };

export interface CustomerSearchPort {
  search(request: CustomerSearchRequest): Promise<CustomerSearchResult>;
}

export interface CustomerSearchSessionState {
  readonly draftQuery: string;
  readonly submittedQuery: string | null;
  readonly filters: CustomerSearchFilters;
  readonly results: readonly CustomerSearchItem[];
  readonly nextCursor: string | null;
  readonly recentQueries: readonly string[];
  readonly failureKind: CustomerSearchFailureKind | null;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasSearched: boolean;
}

export const createInitialCustomerSearchSessionState = (): CustomerSearchSessionState => ({
  draftQuery: '',
  submittedQuery: null,
  filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
  results: [],
  nextCursor: null,
  recentQueries: [],
  failureKind: null,
  isLoading: false,
  isLoadingMore: false,
  hasSearched: false,
});
