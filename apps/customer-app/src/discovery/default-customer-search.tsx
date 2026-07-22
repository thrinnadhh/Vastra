import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerServiceabilityAdapter } from '../location/api-customer-serviceability.adapter';
import { CustomerLocationScreen } from '../location/customer-location.screen';
import type { CustomerCoordinates } from '../location/customer-location.types';
import { ExpoCustomerLocationAdapter } from '../location/expo-customer-location.adapter';
import { ApiCustomerFavouriteAdapter } from './api-customer-favourite.adapter';
import { ApiCustomerProductAdapter } from './api-customer-product.adapter';
import { ApiCustomerSearchAdapter } from './api-customer-search.adapter';
import { ApiCustomerShopAdapter } from './api-customer-shop.adapter';
import { CustomerFavouriteShopsScreen } from './customer-favourite-shops.screen';
import {
  INITIAL_CUSTOMER_FAVOURITE_STATE,
  type CustomerFavouriteState,
} from './customer-favourite.types';
import { CustomerProductScreen } from './customer-product.screen';
import { CustomerSearchScreen } from './customer-search.screen';
import type { CustomerSearchSessionState } from './customer-search.types';
import { CustomerShopsScreen } from './customer-shops.screen';

type CustomerDiscoverMode = 'SEARCH' | 'SHOPS' | 'FAVOURITES';

export function DefaultCustomerSearchRoot({
  location,
  onLocationReady,
  sessionState,
  setSessionState,
}: {
  readonly location: CustomerCoordinates | null;
  readonly onLocationReady: (coordinates: CustomerCoordinates) => void;
  readonly sessionState: CustomerSearchSessionState;
  readonly setSessionState: Dispatch<SetStateAction<CustomerSearchSessionState>>;
}) {
  const apiClient = useCustomerApiClient();
  const searchPort = useMemo(() => new ApiCustomerSearchAdapter(apiClient), [apiClient]);
  const shopPort = useMemo(() => new ApiCustomerShopAdapter(apiClient), [apiClient]);
  const productPort = useMemo(() => new ApiCustomerProductAdapter(apiClient), [apiClient]);
  const favouritePort = useMemo(() => new ApiCustomerFavouriteAdapter(apiClient), [apiClient]);
  const locationPort = useMemo(() => new ExpoCustomerLocationAdapter(), []);
  const serviceabilityPort = useMemo(
    () => new ApiCustomerServiceabilityAdapter(apiClient),
    [apiClient],
  );
  const [locationMode, setLocationMode] = useState(false);
  const [discoverMode, setDiscoverMode] = useState<CustomerDiscoverMode>('SEARCH');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [favouriteState, setFavouriteState] = useState<CustomerFavouriteState>(
    INITIAL_CUSTOMER_FAVOURITE_STATE,
  );

  useEffect(() => {
    let active = true;
    void favouritePort.listFavouriteShops().then((result) => {
      if (!active) return;
      setFavouriteState((current) =>
        result.kind === 'SUCCESS'
          ? {
              ...current,
              shops: result.shops,
              isLoading: false,
              isStale: false,
              failureKind: null,
            }
          : {
              ...current,
              isLoading: false,
              failureKind: result.failureKind,
            },
      );
    });
    return () => {
      active = false;
    };
  }, [favouritePort]);

  const favouriteShopIds = useMemo(
    () => new Set(favouriteState.shops.map((shop) => shop.id)),
    [favouriteState.shops],
  );

  const refreshFavourites = async (preserveVisible: boolean): Promise<void> => {
    setFavouriteState((current) => ({
      ...current,
      isLoading: true,
      failureKind: null,
      statusMessage: null,
    }));
    const result = await favouritePort.listFavouriteShops();
    setFavouriteState((current) =>
      result.kind === 'SUCCESS'
        ? {
            ...current,
            shops: result.shops,
            isLoading: false,
            isStale: false,
            failureKind: null,
          }
        : {
            ...current,
            isLoading: false,
            isStale: preserveVisible && current.shops.length > 0,
            failureKind: result.failureKind,
          },
    );
  };

  const setFavourite = async (shopId: string, isFavourite: boolean): Promise<void> => {
    setFavouriteState((current) => ({
      ...current,
      pendingShopIds: new Set([...current.pendingShopIds, shopId]),
      statusMessage: null,
      failureKind: null,
    }));
    const result = await favouritePort.setFavouriteShop(shopId, isFavourite);

    if (result.kind === 'FAILURE') {
      setFavouriteState((current) => ({
        ...current,
        pendingShopIds: new Set([...current.pendingShopIds].filter((id) => id !== shopId)),
        failureKind: result.failureKind,
        statusMessage: 'The favourite change was not saved.',
      }));
      return;
    }

    setFavouriteState((current) => ({
      ...current,
      shops: result.isFavourite
        ? current.shops
        : current.shops.filter((shop) => shop.id !== shopId),
      pendingShopIds: new Set([...current.pendingShopIds].filter((id) => id !== shopId)),
      statusMessage: result.isFavourite
        ? 'Shop saved to favourites.'
        : 'Shop removed from favourites.',
    }));
    await refreshFavourites(true);
  };

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

  if (locationMode) {
    return (
      <View style={styles.flow}>
        <Pressable
          accessibilityLabel="Back to Discover"
          accessibilityRole="button"
          onPress={() => {
            setLocationMode(false);
          }}
          style={styles.backAction}
        >
          <Text style={styles.backText}>Back to Discover</Text>
        </Pressable>
        <CustomerLocationScreen
          locationPort={locationPort}
          onLocationReady={(coordinates) => {
            onLocationReady(coordinates);
            setLocationMode(false);
          }}
          serviceabilityPort={serviceabilityPort}
        />
      </View>
    );
  }

  const requestLocation = (): void => {
    setLocationMode(true);
  };

  return (
    <View style={styles.root}>
      <View
        accessibilityLabel="Discover content mode"
        accessibilityRole="tablist"
        style={styles.modeTabs}
      >
        <Pressable
          accessibilityLabel="Products search mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: discoverMode === 'SEARCH' }}
          onPress={() => {
            setDiscoverMode('SEARCH');
          }}
          style={[styles.modeTab, discoverMode === 'SEARCH' ? styles.modeTabSelected : null]}
        >
          <Text style={discoverMode === 'SEARCH' ? styles.modeTextSelected : styles.modeText}>
            Products
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Nearby shops mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: discoverMode === 'SHOPS' }}
          onPress={() => {
            setDiscoverMode('SHOPS');
          }}
          style={[styles.modeTab, discoverMode === 'SHOPS' ? styles.modeTabSelected : null]}
        >
          <Text style={discoverMode === 'SHOPS' ? styles.modeTextSelected : styles.modeText}>
            Shops
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Favourite shops mode"
          accessibilityRole="tab"
          accessibilityState={{ selected: discoverMode === 'FAVOURITES' }}
          onPress={() => {
            setDiscoverMode('FAVOURITES');
          }}
          style={[styles.modeTab, discoverMode === 'FAVOURITES' ? styles.modeTabSelected : null]}
        >
          <Text style={discoverMode === 'FAVOURITES' ? styles.modeTextSelected : styles.modeText}>
            Favourites
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {discoverMode === 'SEARCH' ? (
          <CustomerSearchScreen
            location={location}
            onRequestLocation={requestLocation}
            onSelectProduct={setSelectedProductId}
            searchPort={searchPort}
            sessionState={sessionState}
            setSessionState={setSessionState}
          />
        ) : null}
        {discoverMode === 'SHOPS' ? (
          <CustomerShopsScreen
            favouriteShopIds={favouriteShopIds}
            location={location}
            onRequestLocation={requestLocation}
            onSelectProduct={setSelectedProductId}
            onSetFavourite={(shopId, isFavourite) => {
              void setFavourite(shopId, isFavourite);
            }}
            pendingFavouriteShopIds={favouriteState.pendingShopIds}
            shopPort={shopPort}
          />
        ) : null}
        {discoverMode === 'FAVOURITES' ? (
          <CustomerFavouriteShopsScreen
            onBrowseShops={() => {
              setDiscoverMode('SHOPS');
            }}
            onRefresh={() => {
              void refreshFavourites(true);
            }}
            onRemove={(shopId) => {
              void setFavourite(shopId, false);
            }}
            state={favouriteState}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDFB' },
  content: { flex: 1 },
  modeTabs: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DDD7',
    backgroundColor: '#FFFFFF',
  },
  modeTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  modeTabSelected: { backgroundColor: '#F7E9EC' },
  modeText: { color: '#75675F', fontSize: 12, fontWeight: '700' },
  modeTextSelected: { color: '#8E3B46', fontSize: 12, fontWeight: '800' },
  flow: { flex: 1, backgroundColor: '#FFFDFB' },
  backAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20 },
  backText: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
});
