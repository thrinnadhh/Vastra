import { useState, type Dispatch, type SetStateAction } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CUSTOMER_DISCOVERY_LIMITS } from './customer-discovery-performance';
import type { CustomerHomeCoordinates } from './customer-home.types';
import {
  CUSTOMER_SEARCH_GENDERS,
  CUSTOMER_SEARCH_SORTS,
  DEFAULT_CUSTOMER_SEARCH_FILTERS,
  type CustomerSearchFilters,
  type CustomerSearchGender,
  type CustomerSearchItem,
  type CustomerSearchPort,
  type CustomerSearchSessionState,
  type CustomerSearchSort,
} from './customer-search.types';

export interface CustomerSearchScreenProps {
  readonly location: CustomerHomeCoordinates | null;
  readonly searchPort: CustomerSearchPort;
  readonly sessionState: CustomerSearchSessionState;
  readonly setSessionState: Dispatch<SetStateAction<CustomerSearchSessionState>>;
  readonly onRequestLocation: () => void;
  readonly onSelectProduct: (productId: string) => void;
}

interface PriceBand {
  readonly label: string;
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
}

const PRICE_BANDS: readonly PriceBand[] = [
  { label: 'Any price', minPricePaise: null, maxPricePaise: null },
  { label: 'Under ₹500', minPricePaise: null, maxPricePaise: 50_000 },
  { label: '₹500–₹1,000', minPricePaise: 50_000, maxPricePaise: 100_000 },
  { label: '₹1,000–₹2,000', minPricePaise: 100_000, maxPricePaise: 200_000 },
  { label: 'Above ₹2,000', minPricePaise: 200_000, maxPricePaise: null },
];

const SORT_LABELS: Readonly<Record<CustomerSearchSort, string>> = {
  RELEVANCE: 'Relevance',
  DISTANCE: 'Nearest',
  PRICE_ASC: 'Price: low to high',
  PRICE_DESC: 'Price: high to low',
};

const GENDER_LABELS: Readonly<Record<CustomerSearchGender, string>> = {
  MEN: 'Men',
  WOMEN: 'Women',
  KIDS: 'Kids',
  UNISEX: 'Unisex',
};

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  return `₹${String(rupees)}`;
}

function productPrice(product: CustomerSearchItem): string {
  if (product.minimumSellingPricePaise === null) {
    return 'Price unavailable';
  }

  if (
    product.maximumSellingPricePaise !== null &&
    product.maximumSellingPricePaise !== product.minimumSellingPricePaise
  ) {
    return `${formatRupees(product.minimumSellingPricePaise)}–${formatRupees(
      product.maximumSellingPricePaise,
    )}`;
  }

  return formatRupees(product.minimumSellingPricePaise);
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${String(Math.round(distanceMeters))} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function samePriceBand(filters: CustomerSearchFilters, band: PriceBand): boolean {
  return (
    filters.minPricePaise === band.minPricePaise && filters.maxPricePaise === band.maxPricePaise
  );
}

function mergeUniqueProducts(
  existing: readonly CustomerSearchItem[],
  incoming: readonly CustomerSearchItem[],
): readonly CustomerSearchItem[] {
  const seen = new Set(existing.map((product) => product.id));
  return [...existing, ...incoming.filter((product) => !seen.has(product.id))];
}

function SearchProductCard({
  product,
  onPress,
}: {
  readonly product: CustomerSearchItem;
  readonly onPress: () => void;
}) {
  const selectable = product.isAvailable && product.availableVariantCount > 0;

  return (
    <Pressable
      accessibilityLabel={`${product.name} from ${product.shopName}. ${productPrice(product)}. ${
        selectable ? 'Available' : 'Currently unavailable'
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !selectable }}
      disabled={!selectable}
      onPress={onPress}
      style={[styles.productCard, selectable ? null : styles.productCardDisabled]}
      testID={`search-product-${product.id}`}
    >
      <View style={styles.productMedia}>
        {product.imageUrl === null ? (
          <View style={styles.imageFallback}>
            <Text style={styles.imageFallbackText}>Image unavailable</Text>
          </View>
        ) : (
          <Image
            accessibilityLabel={product.imageAlt ?? product.name}
            resizeMode="cover"
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
          />
        )}
      </View>
      <View style={styles.productBody}>
        <Text numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        <Text numberOfLines={1} style={styles.productShop}>
          {product.shopName} · {formatDistance(product.distanceMeters)}
        </Text>
        <Text style={styles.productPrice}>{productPrice(product)}</Text>
        <Text style={selectable ? styles.availableText : styles.unavailableText}>
          {selectable
            ? `${String(product.availableVariantCount)} variant${
                product.availableVariantCount === 1 ? '' : 's'
              } available`
            : 'Currently unavailable'}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomerSearchScreen({
  location,
  searchPort,
  sessionState,
  setSessionState,
  onRequestLocation,
  onSelectProduct,
}: CustomerSearchScreenProps) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const runSearch = async ({
    query,
    filters,
    cursor,
    append,
  }: {
    readonly query: string;
    readonly filters: CustomerSearchFilters;
    readonly cursor: string | null;
    readonly append: boolean;
  }): Promise<void> => {
    if (location === null) {
      return;
    }

    setSessionState((current) => ({
      ...current,
      isLoading: !append,
      isLoadingMore: append,
      failureKind: null,
      ...(append ? null : { hasSearched: true, submittedQuery: query }),
    }));

    const result = await searchPort.search({
      query,
      location,
      filters,
      cursor,
      limit: CUSTOMER_DISCOVERY_LIMITS.searchPageSize,
    });

    setSessionState((current) => {
      if (result.kind === 'FAILURE') {
        return {
          ...current,
          isLoading: false,
          isLoadingMore: false,
          failureKind: result.failureKind,
        };
      }

      const recentQueries = [
        result.page.normalizedQuery,
        ...current.recentQueries.filter((candidate) => candidate !== result.page.normalizedQuery),
      ].slice(0, CUSTOMER_DISCOVERY_LIMITS.recentSearchLimit);

      return {
        ...current,
        draftQuery: result.page.normalizedQuery,
        submittedQuery: result.page.normalizedQuery,
        filters: result.page.filters,
        results: append
          ? mergeUniqueProducts(current.results, result.page.results)
          : result.page.results,
        nextCursor: result.page.nextCursor,
        recentQueries,
        failureKind: null,
        isLoading: false,
        isLoadingMore: false,
        hasSearched: true,
      };
    });
  };

  const submitSearch = (): void => {
    const normalizedQuery = normalizeQuery(sessionState.draftQuery);

    if (normalizedQuery.length < 2 || normalizedQuery.length > 100) {
      setValidationMessage('Enter between 2 and 100 characters.');
      return;
    }

    setValidationMessage(null);
    void runSearch({
      query: normalizedQuery,
      filters: sessionState.filters,
      cursor: null,
      append: false,
    });
  };

  const applyFilters = (filters: CustomerSearchFilters): void => {
    setSessionState((current) => ({ ...current, filters }));
    if (sessionState.submittedQuery !== null) {
      void runSearch({
        query: sessionState.submittedQuery,
        filters,
        cursor: null,
        append: false,
      });
    }
  };

  const resetFilters = (): void => {
    applyFilters(DEFAULT_CUSTOMER_SEARCH_FILTERS);
  };

  if (location === null) {
    return (
      <View style={styles.centerState}>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Set a shopping location first
        </Text>
        <Text style={styles.stateCopy}>
          Search uses your confirmed location to return serviceable local shops and products.
        </Text>
        <Pressable
          accessibilityLabel="Set search location"
          accessibilityRole="button"
          onPress={onRequestLocation}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Set location</Text>
        </Pressable>
      </View>
    );
  }

  const hasActiveFilters =
    sessionState.filters.categoryId !== null ||
    sessionState.filters.gender !== null ||
    sessionState.filters.shopId !== null ||
    sessionState.filters.minPricePaise !== null ||
    sessionState.filters.maxPricePaise !== null ||
    !sessionState.filters.availableOnly ||
    sessionState.filters.sort !== 'RELEVANCE';
  const isInitialFailure = sessionState.failureKind !== null && sessionState.results.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="customer-search-scroll"
    >
      <Text style={styles.eyebrow}>DISCOVER LOCAL FASHION</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Search products near you
      </Text>
      <Text style={styles.locationCopy}>
        Serviceable results around {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search query"
          autoCapitalize="none"
          onChangeText={(draftQuery) => {
            setSessionState((current) => ({ ...current, draftQuery }));
            setValidationMessage(null);
          }}
          onSubmitEditing={submitSearch}
          placeholder="Try cotton shirt or party dress"
          returnKeyType="search"
          style={styles.searchInput}
          testID="customer-search-input"
          value={sessionState.draftQuery}
        />
        <Pressable
          accessibilityLabel="Submit product search"
          accessibilityRole="button"
          disabled={sessionState.isLoading}
          onPress={submitSearch}
          style={[styles.searchButton, sessionState.isLoading ? styles.actionDisabled : null]}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>
      {validationMessage === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.validationText}>
          {validationMessage}
        </Text>
      )}

      {sessionState.recentQueries.length === 0 ? null : (
        <View style={styles.suggestionSection}>
          <Text style={styles.sectionLabel}>Recent searches</Text>
          <View style={styles.chipRow}>
            {sessionState.recentQueries.map((query) => (
              <Pressable
                accessibilityLabel={`Search again for ${query}`}
                accessibilityRole="button"
                key={query}
                onPress={() => {
                  setSessionState((current) => ({ ...current, draftQuery: query }));
                  void runSearch({
                    query,
                    filters: sessionState.filters,
                    cursor: null,
                    append: false,
                  });
                }}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{query}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.filterHeader}>
        <Pressable
          accessibilityLabel={filtersExpanded ? 'Hide search filters' : 'Show search filters'}
          accessibilityRole="button"
          onPress={() => {
            setFiltersExpanded((current) => !current);
          }}
          style={styles.filterToggle}
        >
          <Text style={styles.filterToggleText}>
            {filtersExpanded ? 'Hide filters' : 'Filters and sorting'}
          </Text>
        </Pressable>
        {hasActiveFilters ? (
          <Pressable
            accessibilityLabel="Clear all search filters"
            accessibilityRole="button"
            onPress={resetFilters}
            style={styles.clearAction}
          >
            <Text style={styles.clearActionText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {filtersExpanded ? (
        <View style={styles.filterPanel} testID="customer-search-filters">
          <Text style={styles.sectionLabel}>Gender</Text>
          <View style={styles.chipRow}>
            <Pressable
              accessibilityLabel="Any gender"
              accessibilityRole="button"
              accessibilityState={{ selected: sessionState.filters.gender === null }}
              onPress={() => {
                applyFilters({ ...sessionState.filters, gender: null });
              }}
              style={[
                styles.chip,
                sessionState.filters.gender === null ? styles.chipSelected : null,
              ]}
            >
              <Text style={styles.chipText}>Any</Text>
            </Pressable>
            {CUSTOMER_SEARCH_GENDERS.map((gender) => (
              <Pressable
                accessibilityLabel={`Filter by ${GENDER_LABELS[gender]}`}
                accessibilityRole="button"
                accessibilityState={{ selected: sessionState.filters.gender === gender }}
                key={gender}
                onPress={() => {
                  applyFilters({ ...sessionState.filters, gender });
                }}
                style={[
                  styles.chip,
                  sessionState.filters.gender === gender ? styles.chipSelected : null,
                ]}
              >
                <Text style={styles.chipText}>{GENDER_LABELS[gender]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Price</Text>
          <View style={styles.chipRow}>
            {PRICE_BANDS.map((band) => (
              <Pressable
                accessibilityLabel={`Price filter ${band.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: samePriceBand(sessionState.filters, band) }}
                key={band.label}
                onPress={() => {
                  applyFilters({
                    ...sessionState.filters,
                    minPricePaise: band.minPricePaise,
                    maxPricePaise: band.maxPricePaise,
                  });
                }}
                style={[
                  styles.chip,
                  samePriceBand(sessionState.filters, band) ? styles.chipSelected : null,
                ]}
              >
                <Text style={styles.chipText}>{band.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Sort</Text>
          <View style={styles.chipRow}>
            {CUSTOMER_SEARCH_SORTS.map((sort) => (
              <Pressable
                accessibilityLabel={`Sort by ${SORT_LABELS[sort]}`}
                accessibilityRole="button"
                accessibilityState={{ selected: sessionState.filters.sort === sort }}
                key={sort}
                onPress={() => {
                  applyFilters({ ...sessionState.filters, sort });
                }}
                style={[
                  styles.chip,
                  sessionState.filters.sort === sort ? styles.chipSelected : null,
                ]}
              >
                <Text style={styles.chipText}>{SORT_LABELS[sort]}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityLabel="Toggle available products only"
            accessibilityRole="switch"
            accessibilityState={{ checked: sessionState.filters.availableOnly }}
            onPress={() => {
              applyFilters({
                ...sessionState.filters,
                availableOnly: !sessionState.filters.availableOnly,
              });
            }}
            style={styles.switchRow}
          >
            <View
              style={[
                styles.switchTrack,
                sessionState.filters.availableOnly ? styles.switchTrackActive : null,
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  sessionState.filters.availableOnly ? styles.switchThumbActive : null,
                ]}
              />
            </View>
            <Text style={styles.switchLabel}>Available products only</Text>
          </Pressable>

          {sessionState.filters.categoryId === null ? null : (
            <Text style={styles.boundFilterText}>Category filter applied from discovery.</Text>
          )}
          {sessionState.filters.shopId === null ? null : (
            <Text style={styles.boundFilterText}>Shop filter applied from discovery.</Text>
          )}
        </View>
      ) : null}

      {sessionState.isLoading ? (
        <View accessible accessibilityLiveRegion="polite" style={styles.statusCard}>
          <Text style={styles.statusTitle}>Searching nearby shops…</Text>
          <Text style={styles.statusCopy}>Checking live catalogue and availability.</Text>
        </View>
      ) : null}

      {isInitialFailure ? (
        <View style={styles.statusCard}>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            {sessionState.failureKind === 'OFFLINE' ? 'You are offline' : 'Search could not load'}
          </Text>
          <Text style={styles.statusCopy}>
            {sessionState.failureKind === 'OFFLINE'
              ? 'Reconnect and retry the same preserved search.'
              : 'Try the same search again. Your query and filters are still here.'}
          </Text>
          <Pressable
            accessibilityLabel="Retry product search"
            accessibilityRole="button"
            onPress={submitSearch}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {sessionState.failureKind !== null && sessionState.results.length > 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.staleBanner}>
          <Text style={styles.staleTitle}>Showing previous results</Text>
          <Text style={styles.staleCopy}>The latest refresh failed. Retry when ready.</Text>
        </View>
      ) : null}

      {sessionState.hasSearched &&
      !sessionState.isLoading &&
      sessionState.failureKind === null &&
      sessionState.results.length === 0 ? (
        <View style={styles.statusCard}>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            No matching products nearby
          </Text>
          <Text style={styles.statusCopy}>
            Try a broader term or clear filters while keeping your location.
          </Text>
          <View style={styles.recoveryRow}>
            <Pressable
              accessibilityLabel="Clear filters and retry search"
              accessibilityRole="button"
              onPress={() => {
                const query =
                  sessionState.submittedQuery ?? normalizeQuery(sessionState.draftQuery);
                setSessionState((current) => ({
                  ...current,
                  filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
                }));
                void runSearch({
                  query,
                  filters: DEFAULT_CUSTOMER_SEARCH_FILTERS,
                  cursor: null,
                  append: false,
                });
              }}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>Clear filters</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Edit search query"
              accessibilityRole="button"
              onPress={() => {
                setSessionState((current) => ({
                  ...current,
                  submittedQuery: null,
                  hasSearched: false,
                }));
              }}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>Edit query</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {sessionState.results.length === 0 ? null : (
        <View style={styles.resultsSection} testID="customer-search-results">
          <Text accessibilityRole="header" style={styles.resultsTitle}>
            Results for “{sessionState.submittedQuery}”
          </Text>
          <Text style={styles.resultsCount}>
            {String(sessionState.results.length)} product
            {sessionState.results.length === 1 ? '' : 's'} loaded
          </Text>
          <View style={styles.productGrid}>
            {sessionState.results.map((product) => (
              <SearchProductCard
                key={product.id}
                onPress={() => {
                  onSelectProduct(product.id);
                }}
                product={product}
              />
            ))}
          </View>
          {sessionState.nextCursor === null ? (
            <Text accessibilityLiveRegion="polite" style={styles.endText}>
              You reached the end of these results.
            </Text>
          ) : (
            <Pressable
              accessibilityLabel="Load more search results"
              accessibilityRole="button"
              disabled={sessionState.isLoadingMore}
              onPress={() => {
                const query = sessionState.submittedQuery;
                if (query !== null) {
                  void runSearch({
                    query,
                    filters: sessionState.filters,
                    cursor: sessionState.nextCursor,
                    append: true,
                  });
                }
              }}
              style={[
                styles.loadMoreAction,
                sessionState.isLoadingMore ? styles.actionDisabled : null,
              ]}
            >
              <Text style={styles.loadMoreText}>
                {sessionState.isLoadingMore ? 'Loading more…' : 'Load more'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, backgroundColor: '#FFFDFB' },
  eyebrow: { color: '#8E3B46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 6, color: '#241B16', fontSize: 28, fontWeight: '800' },
  locationCopy: { marginTop: 8, color: '#75675F', fontSize: 13, lineHeight: 19 },
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  searchInput: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#D8CBC2',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    color: '#241B16',
    fontSize: 15,
  },
  searchButton: {
    minWidth: 84,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: '#8E3B46',
  },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  actionDisabled: { opacity: 0.55 },
  validationText: { marginTop: 8, color: '#9B2C2C', fontSize: 13, fontWeight: '700' },
  suggestionSection: { marginTop: 18 },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: '#342620',
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#D8CBC2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { borderColor: '#8E3B46', backgroundColor: '#F7E9EC' },
  chipText: { color: '#4A3B33', fontSize: 13, fontWeight: '700' },
  filterHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6DDD7',
  },
  filterToggle: { minHeight: 48, justifyContent: 'center', paddingRight: 16 },
  filterToggleText: { color: '#342620', fontSize: 14, fontWeight: '800' },
  clearAction: { minHeight: 44, justifyContent: 'center', paddingLeft: 16 },
  clearActionText: { color: '#8E3B46', fontSize: 13, fontWeight: '800' },
  filterPanel: { paddingBottom: 16 },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  switchTrack: {
    width: 46,
    height: 28,
    justifyContent: 'center',
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#CFC4BD',
  },
  switchTrackActive: { backgroundColor: '#8E3B46' },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  switchThumbActive: { alignSelf: 'flex-end' },
  switchLabel: { marginLeft: 10, color: '#342620', fontSize: 14, fontWeight: '700' },
  boundFilterText: { marginTop: 9, color: '#6B4F42', fontSize: 12, fontWeight: '700' },
  centerState: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFFDFB' },
  stateTitle: { color: '#241B16', fontSize: 24, fontWeight: '800' },
  stateCopy: { marginTop: 10, color: '#75675F', fontSize: 15, lineHeight: 22 },
  primaryAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  statusCard: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  statusTitle: { color: '#241B16', fontSize: 18, fontWeight: '800' },
  statusCopy: { marginTop: 7, color: '#75675F', fontSize: 14, lineHeight: 21 },
  secondaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 14,
  },
  secondaryActionText: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
  recoveryRow: { flexDirection: 'row', gap: 10 },
  staleBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF4D8',
  },
  staleTitle: { color: '#704B00', fontSize: 13, fontWeight: '800' },
  staleCopy: { marginTop: 4, color: '#704B00', fontSize: 12, lineHeight: 17 },
  resultsSection: { marginTop: 24 },
  resultsTitle: { color: '#241B16', fontSize: 20, fontWeight: '800' },
  resultsCount: { marginTop: 4, color: '#75675F', fontSize: 13 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  productCard: {
    width: '48%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  productCardDisabled: { opacity: 0.62 },
  productMedia: { width: '100%', aspectRatio: 0.78, backgroundColor: '#F2EDE9' },
  productImage: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  imageFallbackText: { color: '#75675F', fontSize: 12, textAlign: 'center' },
  productBody: { padding: 12 },
  productName: { minHeight: 38, color: '#241B16', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  productShop: { marginTop: 5, color: '#75675F', fontSize: 12 },
  productPrice: { marginTop: 8, color: '#342620', fontSize: 15, fontWeight: '800' },
  availableText: { marginTop: 5, color: '#28623B', fontSize: 11, fontWeight: '700' },
  unavailableText: { marginTop: 5, color: '#9B2C2C', fontSize: 11, fontWeight: '700' },
  loadMoreAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#102A43',
  },
  loadMoreText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  endText: { marginTop: 18, color: '#75675F', fontSize: 13, textAlign: 'center' },
});
