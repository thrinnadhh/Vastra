import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CustomerHomeCoordinates } from './customer-home.types';
import type {
  CustomerNearbyShop,
  CustomerNearbyShopsResult,
  CustomerShopDetail,
  CustomerShopFailureKind,
  CustomerShopPort,
  CustomerShopProduct,
} from './customer-shop.types';

export interface CustomerShopsScreenProps {
  readonly location: CustomerHomeCoordinates | null;
  readonly shopPort: CustomerShopPort;
  readonly onRequestLocation: () => void;
  readonly onSelectProduct: (productId: string) => void;
}

function formatRupees(paise: number): string {
  return `₹${String(Math.floor(paise / 100))}`;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${String(Math.round(distanceMeters))} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function formatRating(ratingAverage: number | null, ratingCount: number): string {
  if (ratingAverage === null || ratingCount === 0) {
    return 'No ratings yet';
  }

  return `${ratingAverage.toFixed(1)} from ${String(ratingCount)} rating${ratingCount === 1 ? '' : 's'}`;
}

function formatHours(detail: CustomerShopDetail): string {
  if (detail.todayHours.source === 'NONE') {
    return 'Hours not published';
  }
  if (detail.todayHours.isClosed) {
    return 'Closed today';
  }
  if (detail.todayHours.opensAt === null || detail.todayHours.closesAt === null) {
    return detail.todayHours.isOpenNow ? 'Open now' : 'Closed now';
  }

  return `${detail.todayHours.isOpenNow ? 'Open now' : 'Closed now'} · ${detail.todayHours.opensAt}–${detail.todayHours.closesAt}`;
}

function orderingCopy(detail: CustomerShopDetail): string {
  switch (detail.orderingStatus) {
    case 'ACCEPTING_ORDERS':
      return 'Accepting online orders';
    case 'BUSY':
      return 'Busy — ordering is temporarily paused';
    case 'CLOSED':
      return 'Closed for ordering';
    case 'OUTSIDE_SERVICE_AREA':
      return 'Outside this delivery area';
    case 'ONLINE_ORDERS_DISABLED':
      return 'Online orders are disabled';
  }
}

function productPrice(product: CustomerShopProduct): string {
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

function mergeUniqueProducts(
  current: readonly CustomerShopProduct[],
  incoming: readonly CustomerShopProduct[],
): readonly CustomerShopProduct[] {
  const ids = new Set(current.map((product) => product.id));
  return [...current, ...incoming.filter((product) => !ids.has(product.id))];
}

function ShopCard({
  shop,
  onPress,
}: {
  readonly shop: CustomerNearbyShop;
  readonly onPress: () => void;
}) {
  const online = shop.operationalStatus === 'OPEN' && shop.acceptsOnlineOrders;

  return (
    <Pressable
      accessibilityLabel={`Open ${shop.name}. ${formatDistance(shop.distanceMeters)}. ${
        online ? 'Accepting online orders' : 'Online ordering unavailable'
      }`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.shopCard}
      testID={`nearby-shop-${shop.id}`}
    >
      <View style={styles.shopInitial}>
        <Text style={styles.shopInitialText}>{shop.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.shopBody}>
        <Text numberOfLines={1} style={styles.shopName}>
          {shop.name}
        </Text>
        <Text style={styles.shopMeta}>{formatDistance(shop.distanceMeters)}</Text>
        <Text style={online ? styles.positiveText : styles.negativeText}>
          {online ? 'Accepting online orders' : 'Online ordering unavailable'}
        </Text>
        <Text style={styles.shopMeta}>
          {String(shop.averagePreparationMinutes)} min preparation · Minimum{' '}
          {formatRupees(shop.minimumOrderPaise)}
        </Text>
        <Text style={styles.shopMeta}>{formatRating(shop.ratingAverage, shop.ratingCount)}</Text>
      </View>
    </Pressable>
  );
}

function ProductCard({
  product,
  onPress,
}: {
  readonly product: CustomerShopProduct;
  readonly onPress: () => void;
}) {
  const selectable = product.isAvailable && product.availableVariantCount > 0;

  return (
    <Pressable
      accessibilityLabel={`${product.name}. ${productPrice(product)}. ${
        selectable ? 'Available' : 'Currently unavailable'
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !selectable }}
      disabled={!selectable}
      onPress={onPress}
      style={[styles.productCard, selectable ? null : styles.productCardDisabled]}
      testID={`shop-product-${product.id}`}
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
        <Text style={styles.productPrice}>{productPrice(product)}</Text>
        <Text style={selectable ? styles.positiveText : styles.negativeText}>
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

function FailureState({
  failureKind,
  onRetry,
}: {
  readonly failureKind: CustomerShopFailureKind;
  readonly onRetry: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {failureKind === 'OFFLINE' ? 'You are offline' : 'Shop information could not load'}
      </Text>
      <Text style={styles.stateCopy}>
        {failureKind === 'OFFLINE'
          ? 'Reconnect and retry with the same shopping location.'
          : 'Try again. Vastra will request the latest shop state.'}
      </Text>
      <Pressable
        accessibilityLabel="Retry shop information"
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryActionText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function CustomerShopsScreen({
  location,
  shopPort,
  onRequestLocation,
  onSelectProduct,
}: CustomerShopsScreenProps) {
  const [shops, setShops] = useState<readonly CustomerNearbyShop[]>([]);
  const [directoryFailure, setDirectoryFailure] = useState<CustomerShopFailureKind | null>(null);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(location !== null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerShopDetail | null>(null);
  const [products, setProducts] = useState<readonly CustomerShopProduct[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detailFailure, setDetailFailure] = useState<CustomerShopFailureKind | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const applyDirectoryResult = useCallback((result: CustomerNearbyShopsResult): void => {
    if (result.kind === 'SUCCESS') {
      setShops(result.shops);
      setDirectoryFailure(null);
    } else {
      setDirectoryFailure(result.failureKind);
    }
    setIsDirectoryLoading(false);
  }, []);

  useEffect(() => {
    if (location === null) {
      return undefined;
    }

    let active = true;
    void shopPort.listNearby(location, 50).then((result) => {
      if (active) {
        applyDirectoryResult(result);
      }
    });

    return () => {
      active = false;
    };
  }, [applyDirectoryResult, location, shopPort]);

  const retryDirectory = (): void => {
    if (location === null) {
      return;
    }

    setIsDirectoryLoading(true);
    void shopPort.listNearby(location, 50).then(applyDirectoryResult);
  };

  const loadSelectedShop = useCallback(
    async (shopId: string) => {
      if (location === null) {
        return;
      }

      const [detailResult, productsResult] = await Promise.all([
        shopPort.getDetail(shopId, location),
        shopPort.listProducts(shopId, null, 20),
      ]);

      if (detailResult.kind === 'SUCCESS' && productsResult.kind === 'SUCCESS') {
        setDetail(detailResult.shop);
        setProducts(productsResult.products);
        setNextCursor(productsResult.nextCursor);
        setDetailFailure(null);
      } else if (detailResult.kind === 'FAILURE') {
        setDetailFailure(detailResult.failureKind);
      } else if (productsResult.kind === 'FAILURE') {
        setDetailFailure(productsResult.failureKind);
      }
      setIsDetailLoading(false);
    },
    [location, shopPort],
  );

  const openShop = (shopId: string): void => {
    setSelectedShopId(shopId);
    setDetail(null);
    setProducts([]);
    setNextCursor(null);
    setDetailFailure(null);
    setIsDetailLoading(true);
    void loadSelectedShop(shopId);
  };

  if (location === null) {
    return (
      <View style={styles.centerState}>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Set a shopping location first
        </Text>
        <Text style={styles.stateCopy}>
          Nearby shops are filtered by the server-confirmed service area around your location.
        </Text>
        <Pressable
          accessibilityLabel="Set nearby shop location"
          accessibilityRole="button"
          onPress={onRequestLocation}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Set location</Text>
        </Pressable>
      </View>
    );
  }

  if (selectedShopId !== null) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="customer-shop-detail-scroll"
      >
        <Pressable
          accessibilityLabel="Back to nearby shops"
          accessibilityRole="button"
          onPress={() => {
            setSelectedShopId(null);
            setDetail(null);
            setProducts([]);
            setDetailFailure(null);
          }}
          style={styles.backAction}
        >
          <Text style={styles.backActionText}>Back to nearby shops</Text>
        </Pressable>

        {isDetailLoading ? (
          <View accessible accessibilityLiveRegion="polite" style={styles.stateCard}>
            <Text style={styles.stateTitle}>Loading shop…</Text>
            <Text style={styles.stateCopy}>
              Checking current hours, serviceability, and catalogue.
            </Text>
          </View>
        ) : null}

        {detailFailure === null ? null : (
          <FailureState
            failureKind={detailFailure}
            onRetry={() => {
              setIsDetailLoading(true);
              void loadSelectedShop(selectedShopId);
            }}
          />
        )}

        {detail === null ? null : (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>LOCAL SHOP</Text>
              <Text accessibilityRole="header" style={styles.heroTitle}>
                {detail.name}
              </Text>
              {detail.description === null ? null : (
                <Text style={styles.heroCopy}>{detail.description}</Text>
              )}
              <Text style={detail.canPlaceOrder ? styles.heroPositive : styles.heroWarning}>
                {orderingCopy(detail)}
              </Text>
            </View>

            <View style={styles.factGrid}>
              <View style={styles.factCard}>
                <Text style={styles.factLabel}>Distance</Text>
                <Text style={styles.factValue}>{formatDistance(detail.distanceMeters)}</Text>
              </View>
              <View style={styles.factCard}>
                <Text style={styles.factLabel}>Today</Text>
                <Text style={styles.factValue}>{formatHours(detail)}</Text>
              </View>
              <View style={styles.factCard}>
                <Text style={styles.factLabel}>Preparation estimate</Text>
                <Text style={styles.factValue}>
                  {String(detail.averagePreparationMinutes)} minutes
                </Text>
              </View>
              <View style={styles.factCard}>
                <Text style={styles.factLabel}>Minimum order</Text>
                <Text style={styles.factValue}>{formatRupees(detail.minimumOrderPaise)}</Text>
              </View>
            </View>

            <View style={styles.contactCard}>
              <Text style={styles.sectionTitle}>Shop information</Text>
              <Text style={styles.contactText}>
                {formatRating(detail.ratingAverage, detail.ratingCount)}
              </Text>
              <Text style={styles.contactText}>{String(detail.followerCount)} followers</Text>
              <Text style={styles.contactText}>{detail.phoneNumber}</Text>
              {detail.email === null ? null : (
                <Text style={styles.contactText}>{detail.email}</Text>
              )}
              <Text style={styles.contactText}>
                Service radius {(detail.serviceRadiusMeters / 1000).toFixed(1)} km
              </Text>
            </View>

            <View style={styles.catalogueHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Shop catalogue
              </Text>
              <Text style={styles.catalogueCount}>
                {String(products.length)} product{products.length === 1 ? '' : 's'} loaded
              </Text>
            </View>

            {products.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>No products available</Text>
                <Text style={styles.stateCopy}>
                  This shop has no currently published catalogue products.
                </Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    onPress={() => {
                      onSelectProduct(product.id);
                    }}
                    product={product}
                  />
                ))}
              </View>
            )}

            {nextCursor === null ? null : (
              <Pressable
                accessibilityLabel="Load more shop products"
                accessibilityRole="button"
                disabled={isLoadingMore}
                onPress={() => {
                  setIsLoadingMore(true);
                  void shopPort.listProducts(detail.id, nextCursor, 20).then((result) => {
                    if (result.kind === 'SUCCESS') {
                      setProducts((current) => mergeUniqueProducts(current, result.products));
                      setNextCursor(result.nextCursor);
                      setDetailFailure(null);
                    } else {
                      setDetailFailure(result.failureKind);
                    }
                    setIsLoadingMore(false);
                  });
                }}
                style={[styles.loadMoreAction, isLoadingMore ? styles.actionDisabled : null]}
              >
                <Text style={styles.loadMoreText}>
                  {isLoadingMore ? 'Loading more…' : 'Load more products'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      testID="customer-nearby-shops-scroll"
    >
      <Text style={styles.eyebrow}>SERVICEABLE NEAR YOU</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Nearby clothing shops
      </Text>
      <Text style={styles.locationCopy}>
        Shops serving {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
      </Text>

      {isDirectoryLoading ? (
        <View accessible accessibilityLiveRegion="polite" style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading nearby shops…</Text>
          <Text style={styles.stateCopy}>
            Checking server-confirmed distance and service areas.
          </Text>
        </View>
      ) : null}

      {directoryFailure === null ? null : (
        <FailureState failureKind={directoryFailure} onRetry={retryDirectory} />
      )}

      {!isDirectoryLoading && directoryFailure === null && shops.length === 0 ? (
        <View style={styles.stateCard}>
          <Text accessibilityRole="header" style={styles.stateTitle}>
            No serviceable shops nearby
          </Text>
          <Text style={styles.stateCopy}>Change your shopping location to check another area.</Text>
          <Pressable
            accessibilityLabel="Change nearby shop location"
            accessibilityRole="button"
            onPress={onRequestLocation}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Change location</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.shopList}>
        {shops.map((shop) => (
          <ShopCard
            key={shop.id}
            onPress={() => {
              openShop(shop.id);
            }}
            shop={shop}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, backgroundColor: '#FFFDFB' },
  centerState: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFFDFB' },
  eyebrow: { color: '#8E3B46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 6, color: '#241B16', fontSize: 28, fontWeight: '800' },
  locationCopy: { marginTop: 8, color: '#75675F', fontSize: 13, lineHeight: 19 },
  stateCard: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  stateTitle: { color: '#241B16', fontSize: 18, fontWeight: '800' },
  stateCopy: { marginTop: 7, color: '#75675F', fontSize: 14, lineHeight: 21 },
  primaryAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
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
  shopList: { gap: 12, marginTop: 20 },
  shopCard: {
    minHeight: 130,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  shopInitial: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#EEE5FA',
  },
  shopInitialText: { color: '#542887', fontSize: 24, fontWeight: '800' },
  shopBody: { flex: 1, marginLeft: 14 },
  shopName: { color: '#241B16', fontSize: 16, fontWeight: '800' },
  shopMeta: { marginTop: 4, color: '#75675F', fontSize: 12, lineHeight: 17 },
  positiveText: { marginTop: 4, color: '#28623B', fontSize: 12, fontWeight: '700' },
  negativeText: { marginTop: 4, color: '#9B2C2C', fontSize: 12, fontWeight: '700' },
  backAction: { minHeight: 46, justifyContent: 'center', alignSelf: 'flex-start' },
  backActionText: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
  hero: { marginTop: 8, padding: 22, borderRadius: 22, backgroundColor: '#102A43' },
  heroTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  heroCopy: { marginTop: 9, color: '#D9E5F2', fontSize: 14, lineHeight: 21 },
  heroPositive: { marginTop: 14, color: '#B8F2C8', fontSize: 14, fontWeight: '800' },
  heroWarning: { marginTop: 14, color: '#FFD9A0', fontSize: 14, fontWeight: '800' },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  factCard: {
    width: '48%',
    minHeight: 92,
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  factLabel: { color: '#75675F', fontSize: 11, fontWeight: '700' },
  factValue: { marginTop: 6, color: '#241B16', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  contactCard: { marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: '#F7F1EC' },
  sectionTitle: { color: '#241B16', fontSize: 20, fontWeight: '800' },
  contactText: { marginTop: 7, color: '#5B493F', fontSize: 13, lineHeight: 19 },
  catalogueHeader: { marginTop: 26 },
  catalogueCount: { marginTop: 4, color: '#75675F', fontSize: 13 },
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
  productPrice: { marginTop: 8, color: '#342620', fontSize: 15, fontWeight: '800' },
  loadMoreAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 15,
    backgroundColor: '#102A43',
  },
  loadMoreText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  actionDisabled: { opacity: 0.55 },
});
