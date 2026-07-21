import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import type {
  CustomerHomeContent,
  CustomerHomeCoordinates,
  CustomerHomeFailureKind,
  CustomerHomePort,
  CustomerHomeProduct,
  CustomerHomeShop,
} from './customer-home.types';

export interface CustomerHomeScreenProps {
  readonly coordinates: CustomerHomeCoordinates;
  readonly homePort: CustomerHomePort;
  readonly onChangeLocation: () => void;
  readonly onSearch: () => void;
  readonly onSelectCategory: (categoryId: string) => void;
  readonly onSelectShop: (shopId: string) => void;
  readonly onSelectProduct: (productId: string) => void;
  readonly onOpenCheckout: () => void;
}

function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const groups: string[] = [];
  let remainder = String(rupees);

  if (remainder.length > 3) {
    groups.unshift(remainder.slice(-3));
    remainder = remainder.slice(0, -3);
    while (remainder.length > 2) {
      groups.unshift(remainder.slice(-2));
      remainder = remainder.slice(0, -2);
    }
  }

  groups.unshift(remainder);
  return `₹${groups.join(',')}`;
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${String(Math.round(distanceMeters))} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function shopStatus(shop: CustomerHomeShop): string {
  if (shop.operationalStatus === 'OPEN' && shop.acceptsOnlineOrders) {
    return 'Open for online orders';
  }

  if (!shop.acceptsOnlineOrders) {
    return 'Online ordering unavailable';
  }

  return shop.operationalStatus.replaceAll('_', ' ').toLowerCase();
}

function productPrice(product: CustomerHomeProduct): string {
  if (product.minimumSellingPricePaise === null) {
    return 'Price unavailable';
  }

  if (
    product.maximumSellingPricePaise !== null &&
    product.maximumSellingPricePaise !== product.minimumSellingPricePaise
  ) {
    return `${formatRupees(product.minimumSellingPricePaise)}–${formatRupees(product.maximumSellingPricePaise)}`;
  }

  return formatRupees(product.minimumSellingPricePaise);
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {actionLabel === undefined || onAction === undefined ? null : (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={styles.sectionAction}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ShopCard({
  shop,
  onPress,
}: {
  readonly shop: CustomerHomeShop;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${shop.name}. ${formatDistance(shop.distanceMeters)}. ${shopStatus(shop)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.shopCard}
      testID={`home-shop-${shop.id}`}
    >
      <View style={styles.shopInitial}>
        <Text style={styles.shopInitialText}>{shop.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.shopBody}>
        <Text numberOfLines={1} style={styles.shopName}>
          {shop.name}
        </Text>
        <Text style={styles.shopMeta}>{formatDistance(shop.distanceMeters)}</Text>
        <Text style={styles.shopMeta}>{shopStatus(shop)}</Text>
        <Text style={styles.shopMeta}>
          {shop.averagePreparationMinutes} min preparation · Minimum{' '}
          {formatRupees(shop.minimumOrderPaise)}
        </Text>
      </View>
    </Pressable>
  );
}

function ProductCard({
  product,
  onPress,
}: {
  readonly product: CustomerHomeProduct;
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
      testID={`home-product-${product.id}`}
    >
      <View style={styles.productMedia}>
        {product.primaryImageUrl === null ? (
          <View style={styles.productFallback}>
            <Text style={styles.productFallbackText}>Image unavailable</Text>
          </View>
        ) : (
          <Image
            accessibilityLabel={product.primaryImageAlt ?? product.name}
            resizeMode="cover"
            source={{ uri: product.primaryImageUrl }}
            style={styles.productImage}
          />
        )}
      </View>
      <View style={styles.productBody}>
        <Text numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        <Text numberOfLines={1} style={styles.productShop}>
          {product.shopName}
        </Text>
        <Text style={styles.productPrice}>{productPrice(product)}</Text>
        <Text style={selectable ? styles.availableText : styles.unavailableText}>
          {selectable
            ? `${String(product.availableVariantCount)} variant${product.availableVariantCount === 1 ? '' : 's'} available`
            : 'Currently unavailable'}
        </Text>
      </View>
    </Pressable>
  );
}

function HomeContent({
  content,
  onChangeLocation,
  onSearch,
  onSelectCategory,
  onSelectShop,
  onSelectProduct,
  onOpenCheckout,
}: Omit<CustomerHomeScreenProps, 'coordinates' | 'homePort'> & {
  readonly content: CustomerHomeContent;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="customer-home-scroll"
    >
      <View style={styles.topRow}>
        <View style={styles.locationCopy}>
          <Text style={styles.eyebrow}>SHOPPING NEAR</Text>
          <Text style={styles.locationText}>
            {content.location.latitude.toFixed(3)}, {content.location.longitude.toFixed(3)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Change shopping location"
          accessibilityRole="button"
          onPress={onChangeLocation}
          style={styles.locationAction}
        >
          <Text style={styles.locationActionText}>Change</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Search local fashion"
        accessibilityRole="button"
        onPress={onSearch}
        style={styles.searchAction}
      >
        <Text style={styles.searchText}>Search dresses, shirts, footwear and more</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>LOCAL FASHION, ONE PLACE</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Find every kind of style from shops around you.
        </Text>
        <Text style={styles.heroCopy}>
          Browse live catalogue and availability data from serviceable local stores.
        </Text>
        <Pressable
          accessibilityLabel="Explore local fashion"
          accessibilityRole="button"
          onPress={onSearch}
          style={styles.heroAction}
        >
          <Text style={styles.heroActionText}>Explore fashion</Text>
        </Pressable>
      </View>

      {content.categories.length === 0 ? null : (
        <View style={styles.section} testID="home-categories">
          <SectionHeader title="Shop by category" />
          <View style={styles.categoryGrid}>
            {content.categories.map((category) => (
              <Pressable
                accessibilityLabel={`Browse ${category.name}`}
                accessibilityRole="button"
                key={category.id}
                onPress={() => {
                  onSelectCategory(category.id);
                }}
                style={styles.categoryCard}
              >
                <Text numberOfLines={1} style={styles.categoryName}>
                  {category.name}
                </Text>
                {category.description === null ? null : (
                  <Text numberOfLines={2} style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section} testID="home-nearby-shops">
        <SectionHeader
          actionLabel="See all nearby shops"
          onAction={onSearch}
          title="Nearby shops"
        />
        <View style={styles.shopList}>
          {content.nearbyShops.map((shop) => (
            <ShopCard
              key={shop.id}
              onPress={() => {
                onSelectShop(shop.id);
              }}
              shop={shop}
            />
          ))}
        </View>
      </View>

      {content.nearbyProducts.length === 0 ? null : (
        <View style={styles.section} testID="home-nearby-products">
          <SectionHeader
            actionLabel="Browse all products"
            onAction={onSearch}
            title="Available near you"
          />
          <View style={styles.productGrid}>
            {content.nearbyProducts.map((product) => (
              <ProductCard
                key={product.id}
                onPress={() => {
                  onSelectProduct(product.id);
                }}
                product={product}
              />
            ))}
          </View>
        </View>
      )}

      <View accessible accessibilityLabel="Vastra discovery information" style={styles.trustStrip}>
        <Text style={styles.trustItem}>Local shop catalogues</Text>
        <Text style={styles.trustDivider}>·</Text>
        <Text style={styles.trustItem}>Live availability</Text>
        <Text style={styles.trustDivider}>·</Text>
        <Text style={styles.trustItem}>Server-checked service area</Text>
      </View>

      <Pressable
        accessibilityLabel="Continue to checkout"
        accessibilityRole="button"
        onPress={onOpenCheckout}
        style={styles.checkoutAction}
      >
        <Text style={styles.checkoutActionText}>Continue to checkout</Text>
      </Pressable>
    </ScrollView>
  );
}

export function CustomerHomeScreen(props: CustomerHomeScreenProps) {
  const [content, setContent] = useState<CustomerHomeContent | null>(null);
  const [failureKind, setFailureKind] = useState<CustomerHomeFailureKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHome = useCallback(async () => {
    const result = await props.homePort.loadHome(props.coordinates);

    if (result.kind === 'SUCCESS') {
      setContent(result.content);
      setFailureKind(null);
    } else {
      setFailureKind(result.failureKind);
    }
    setIsLoading(false);
  }, [props.coordinates, props.homePort]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const retryHome = (): void => {
    setIsLoading(true);
    void loadHome();
  };

  const hasVisibleData =
    content !== null && (content.nearbyShops.length > 0 || content.nearbyProducts.length > 0);
  const networkState = resolveCustomerNetworkState({
    isLoading,
    isOffline: failureKind === 'OFFLINE',
    errorMessage:
      failureKind === 'ERROR'
        ? 'Home could not be refreshed. Try again to load local shops and products.'
        : null,
    hasData: hasVisibleData,
    hasStaleData: content !== null,
    loadingLabel: 'Loading local fashion from nearby shops',
    emptyTitle: 'No serviceable shops here yet',
    emptyMessage: 'Change your shopping location to look for local fashion in another area.',
    emptyActionLabel: 'Change location',
  });

  return (
    <CustomerNetworkStateBoundary
      onEmptyAction={props.onChangeLocation}
      onRetry={retryHome}
      state={networkState}
    >
      {content === null ? null : <HomeContent {...props} content={content} />}
    </CustomerNetworkStateBoundary>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32, backgroundColor: '#FFFDFB' },
  topRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  locationCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: '#6B4F42', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  locationText: { marginTop: 3, color: '#241B16', fontSize: 14, fontWeight: '700' },
  locationAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  locationActionText: { color: '#6B2D38', fontSize: 14, fontWeight: '800' },
  searchAction: {
    minHeight: 50,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D8CBC2',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  searchText: { color: '#75675F', fontSize: 15 },
  hero: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#102A43',
  },
  heroEyebrow: { color: '#F2C66D', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { marginTop: 10, color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 34 },
  heroCopy: { marginTop: 10, color: '#D9E5F2', fontSize: 15, lineHeight: 22 },
  heroAction: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#F2C66D',
  },
  heroActionText: { color: '#241B16', fontSize: 15, fontWeight: '800' },
  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { flex: 1, color: '#241B16', fontSize: 21, fontWeight: '800' },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  sectionActionText: { color: '#6B2D38', fontSize: 13, fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  categoryCard: {
    width: '48%',
    minHeight: 84,
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  categoryName: { color: '#342620', fontSize: 15, fontWeight: '800' },
  categoryDescription: { marginTop: 4, color: '#75675F', fontSize: 12, lineHeight: 17 },
  shopList: { gap: 12, marginTop: 10 },
  shopCard: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DDD7',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  shopInitial: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#EEE5FA',
  },
  shopInitialText: { color: '#542887', fontSize: 24, fontWeight: '800' },
  shopBody: { flex: 1, marginLeft: 14 },
  shopName: { color: '#241B16', fontSize: 16, fontWeight: '800' },
  shopMeta: { marginTop: 3, color: '#75675F', fontSize: 12, lineHeight: 17 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
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
  productFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  productFallbackText: { color: '#75675F', fontSize: 12, textAlign: 'center' },
  productBody: { padding: 12 },
  productName: { minHeight: 38, color: '#241B16', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  productShop: { marginTop: 5, color: '#75675F', fontSize: 12 },
  productPrice: { marginTop: 8, color: '#342620', fontSize: 15, fontWeight: '800' },
  availableText: { marginTop: 5, color: '#28623B', fontSize: 11, fontWeight: '700' },
  unavailableText: { marginTop: 5, color: '#9B2C2C', fontSize: 11, fontWeight: '700' },
  trustStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 28,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F7F1EC',
  },
  trustItem: { color: '#5B493F', fontSize: 12, fontWeight: '700' },
  trustDivider: { marginHorizontal: 7, color: '#9B8A80', fontSize: 12 },
  checkoutAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#8E3B46',
  },
  checkoutActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
