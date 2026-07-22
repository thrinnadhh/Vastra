import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  CustomerProductDetail,
  CustomerProductFailureKind,
  CustomerProductPort,
  CustomerProductVariant,
} from './customer-product.types';

interface CustomerProductScreenProps {
  readonly productId: string;
  readonly productPort: CustomerProductPort;
  readonly onBack: () => void;
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function variantLabel(variant: CustomerProductVariant): string {
  return (
    [variant.sizeLabel, variant.colourName].filter((value) => value !== null).join(' · ') ||
    variant.sku
  );
}

function failureCopy(kind: CustomerProductFailureKind): string {
  switch (kind) {
    case 'OFFLINE':
      return 'You appear to be offline. Reconnect and retry.';
    case 'NOT_FOUND':
      return 'This product is no longer available in the customer catalogue.';
    case 'UNAVAILABLE':
      return 'The selected variant is no longer available. Refresh before choosing another option.';
    case 'CART_CONFLICT':
      return 'Your cart contains items from another shop.';
    case 'ERROR':
      return 'Product details could not be loaded. Retry the authoritative request.';
  }
}

function choosePrimaryImage(product: CustomerProductDetail): string | null {
  return product.images.find((image) => image.isPrimary)?.id ?? product.images[0]?.id ?? null;
}

function chooseAvailableVariant(product: CustomerProductDetail): string | null {
  return (
    product.variants.find((variant) => variant.isAvailable && variant.availableQuantity > 0)?.id ??
    null
  );
}

export function CustomerProductScreen({
  productId,
  productPort,
  onBack,
}: CustomerProductScreenProps) {
  const [product, setProduct] = useState<CustomerProductDetail | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [failureKind, setFailureKind] = useState<CustomerProductFailureKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [cartConflict, setCartConflict] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const applyProduct = (nextProduct: CustomerProductDetail): void => {
    setProduct(nextProduct);
    setSelectedImageId((current) =>
      current !== null && nextProduct.images.some((image) => image.id === current)
        ? current
        : choosePrimaryImage(nextProduct),
    );
    setSelectedVariantId((current) =>
      current !== null &&
      nextProduct.variants.some(
        (variant) => variant.id === current && variant.isAvailable && variant.availableQuantity > 0,
      )
        ? current
        : chooseAvailableVariant(nextProduct),
    );
    setQuantity((current) => Math.max(1, current));
    setFailureKind(null);
    setIsStale(false);
  };

  useEffect(() => {
    let active = true;

    void productPort.getProduct(productId).then((result) => {
      if (!active) return;
      if (result.kind === 'SUCCESS') {
        applyProduct(result.product);
      } else {
        setFailureKind(result.failureKind);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [productId, productPort]);

  const selectedImage = useMemo(
    () => product?.images.find((image) => image.id === selectedImageId) ?? null,
    [product, selectedImageId],
  );
  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [product, selectedVariantId],
  );

  const refresh = async (): Promise<boolean> => {
    setIsRefreshing(true);
    const result = await productPort.getProduct(productId);
    setIsRefreshing(false);

    if (result.kind === 'SUCCESS') {
      applyProduct(result.product);
      return true;
    }

    setFailureKind(result.failureKind);
    if (product !== null) setIsStale(true);
    return false;
  };

  const addToCart = async (replaceExistingCart: boolean): Promise<void> => {
    if (
      selectedVariant === null ||
      !selectedVariant.isAvailable ||
      selectedVariant.availableQuantity < quantity
    ) {
      setFailureKind('UNAVAILABLE');
      return;
    }

    setIsAdding(true);
    setFailureKind(null);
    setSuccessMessage(null);
    const result = await productPort.addToCart(selectedVariant.id, quantity, replaceExistingCart);
    setIsAdding(false);

    if (result.kind === 'SUCCESS') {
      setCartConflict(false);
      setSuccessMessage(
        `Added to cart. Your cart now contains ${String(result.cartItemCount)} item${
          result.cartItemCount === 1 ? '' : 's'
        }.`,
      );
      await refresh();
      return;
    }

    setFailureKind(result.failureKind);
    setCartConflict(result.failureKind === 'CART_CONFLICT');
  };

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <Text accessibilityLiveRegion="polite" style={styles.stateTitle}>
          Loading product details…
        </Text>
      </View>
    );
  }

  if (product === null) {
    return (
      <View style={styles.centerState}>
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Product unavailable
        </Text>
        <Text style={styles.stateCopy}>{failureCopy(failureKind ?? 'ERROR')}</Text>
        <Pressable
          accessibilityLabel="Retry product details"
          accessibilityRole="button"
          onPress={() => {
            setIsLoading(true);
            setFailureKind(null);
            void productPort.getProduct(productId).then((result) => {
              if (result.kind === 'SUCCESS') applyProduct(result.product);
              else setFailureKind(result.failureKind);
              setIsLoading(false);
            });
          }}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Retry</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.linkAction}>
          <Text style={styles.linkText}>Back to discovery</Text>
        </Pressable>
      </View>
    );
  }

  const maximumQuantity = selectedVariant?.availableQuantity ?? 1;
  const canAdd =
    selectedVariant !== null &&
    selectedVariant.isAvailable &&
    selectedVariant.availableQuantity >= quantity &&
    product.shop.acceptsOnlineOrders &&
    !isAdding;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to discovery"
          accessibilityRole="button"
          onPress={onBack}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Refresh product price and stock"
          accessibilityRole="button"
          disabled={isRefreshing}
          onPress={() => {
            void refresh();
          }}
        >
          <Text style={styles.refreshText}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isStale ? (
          <View accessibilityLiveRegion="polite" style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Showing the last successful product details. Price or stock refresh failed.
            </Text>
          </View>
        ) : null}

        <View style={styles.heroMedia}>
          {selectedImage === null ? (
            <Text style={styles.mediaFallback}>No product image supplied</Text>
          ) : (
            <Image
              accessibilityLabel={selectedImage.altText ?? product.name}
              resizeMode="cover"
              source={{ uri: selectedImage.imageUrl }}
              style={styles.heroImage}
            />
          )}
        </View>

        {product.images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
            {product.images.map((image) => (
              <Pressable
                accessibilityLabel={`Show image ${String(image.displayOrder + 1)} of ${product.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: image.id === selectedImageId }}
                key={image.id}
                onPress={() => {
                  setSelectedImageId(image.id);
                }}
                style={[
                  styles.thumbnailButton,
                  image.id === selectedImageId ? styles.thumbnailSelected : null,
                ]}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  resizeMode="cover"
                  source={{ uri: image.thumbnailUrl ?? image.imageUrl }}
                  style={styles.thumbnailImage}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.eyebrow}>{product.brand ?? product.gender}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {product.name}
        </Text>
        {product.description === null ? null : (
          <Text style={styles.description}>{product.description}</Text>
        )}

        <View style={styles.shopCard}>
          <Text style={styles.sectionTitle}>Sold by {product.shop.name}</Text>
          <Text style={styles.metaText}>
            {product.shop.acceptsOnlineOrders
              ? `Online orders enabled · ${product.shop.operationalStatus}`
              : 'Online orders are currently disabled'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Choose a variant</Text>
        <View style={styles.variantGrid}>
          {product.variants.map((variant) => {
            const available = variant.isAvailable && variant.availableQuantity > 0;
            return (
              <Pressable
                accessibilityLabel={`${variantLabel(variant)}, ${
                  available ? `${String(variant.availableQuantity)} available` : 'unavailable'
                }`}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !available,
                  selected: variant.id === selectedVariantId,
                }}
                disabled={!available}
                key={variant.id}
                onPress={() => {
                  setSelectedVariantId(variant.id);
                  setQuantity(1);
                  setFailureKind(null);
                  setCartConflict(false);
                }}
                style={[
                  styles.variantButton,
                  variant.id === selectedVariantId ? styles.variantSelected : null,
                  !available ? styles.variantDisabled : null,
                ]}
                testID={`product-variant-${variant.id}`}
              >
                <Text style={styles.variantName}>{variantLabel(variant)}</Text>
                <Text style={styles.variantPrice}>{formatInr(variant.sellingPricePaise)}</Text>
                {variant.mrpPaise > variant.sellingPricePaise ? (
                  <Text style={styles.mrpText}>MRP {formatInr(variant.mrpPaise)}</Text>
                ) : null}
                <Text style={available ? styles.stockText : styles.unavailableText}>
                  {available ? `${String(variant.availableQuantity)} in stock` : 'Unavailable'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sizeNotice}>
          <Text style={styles.sizeNoticeTitle}>Size information</Text>
          <Text style={styles.metaText}>
            Available size labels are shown on each variant. A measurement-based size chart is not
            present in the current catalogue contract.
          </Text>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease quantity"
              accessibilityRole="button"
              disabled={quantity <= 1}
              onPress={() => {
                setQuantity((current) => Math.max(1, current - 1));
              }}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.quantityText}>
              {quantity}
            </Text>
            <Pressable
              accessibilityLabel="Increase quantity"
              accessibilityRole="button"
              disabled={selectedVariant === null || quantity >= maximumQuantity}
              onPress={() => {
                setQuantity((current) => Math.min(maximumQuantity, current + 1));
              }}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        </View>

        {failureKind !== null ? (
          <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
            <Text style={styles.errorText}>{failureCopy(failureKind)}</Text>
          </View>
        ) : null}
        {successMessage === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.successText}>
            {successMessage}
          </Text>
        )}

        {cartConflict ? (
          <View style={styles.conflictCard}>
            <Text style={styles.sectionTitle}>Replace the existing cart?</Text>
            <Text style={styles.metaText}>
              Vastra supports one shop per cart. Replacing removes the previous shop’s items before
              adding this variant.
            </Text>
            <Pressable
              accessibilityLabel="Replace cart and add selected variant"
              accessibilityRole="button"
              disabled={isAdding}
              onPress={() => {
                void addToCart(true);
              }}
              style={styles.dangerAction}
            >
              <Text style={styles.primaryActionText}>
                {isAdding ? 'Replacing…' : 'Replace cart and add'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Add selected variant to cart"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAdd }}
            disabled={!canAdd}
            onPress={() => {
              void addToCart(false);
            }}
            style={[styles.primaryAction, !canAdd ? styles.primaryActionDisabled : null]}
          >
            <Text style={styles.primaryActionText}>{isAdding ? 'Adding…' : 'Add to cart'}</Text>
          </Pressable>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Product information</Text>
          <Text style={styles.metaText}>Material: {product.material ?? 'Not supplied'}</Text>
          <Text style={styles.metaText}>
            Returns:{' '}
            {product.returnEligible
              ? `Eligible within ${String(product.returnWindowDays)} day${
                  product.returnWindowDays === 1 ? '' : 's'
                }`
              : 'Not eligible'}
          </Text>
          {product.careInstructions === null ? null : (
            <Text style={styles.metaText}>Care: {product.careInstructions}</Text>
          )}
          {product.styleTags.length === 0 ? null : (
            <Text style={styles.metaText}>Style: {product.styleTags.join(', ')}</Text>
          )}
          {product.occasionTags.length === 0 ? null : (
            <Text style={styles.metaText}>Occasions: {product.occasionTags.join(', ')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDFB' },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DDD7',
    backgroundColor: '#FFFFFF',
  },
  backText: { color: '#8E3B46', fontSize: 15, fontWeight: '800' },
  refreshText: { color: '#6B2D38', fontSize: 14, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 48 },
  heroMedia: {
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#F0E9E4',
  },
  heroImage: { width: '100%', height: '100%' },
  mediaFallback: { color: '#7A6C64', fontSize: 14, fontWeight: '700' },
  thumbnailRow: { marginTop: 12 },
  thumbnailButton: {
    width: 66,
    height: 78,
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  thumbnailSelected: { borderColor: '#8E3B46' },
  thumbnailImage: { width: '100%', height: '100%' },
  eyebrow: { marginTop: 18, color: '#8E3B46', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 5, color: '#241B16', fontSize: 29, fontWeight: '800' },
  description: { marginTop: 10, color: '#665A52', fontSize: 15, lineHeight: 23 },
  sectionTitle: { color: '#2D211B', fontSize: 16, fontWeight: '800' },
  metaText: { marginTop: 5, color: '#6F625A', fontSize: 14, lineHeight: 21 },
  shopCard: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: '#F7EFEA' },
  variantGrid: { marginTop: 10, gap: 10 },
  variantButton: {
    minHeight: 86,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D9CDC5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  variantSelected: { borderWidth: 2, borderColor: '#8E3B46', backgroundColor: '#FFF4F6' },
  variantDisabled: { opacity: 0.45 },
  variantName: { color: '#30241E', fontSize: 15, fontWeight: '800' },
  variantPrice: { marginTop: 4, color: '#30241E', fontSize: 16, fontWeight: '800' },
  mrpText: { marginTop: 2, color: '#7A6C64', fontSize: 12, textDecorationLine: 'line-through' },
  stockText: { marginTop: 4, color: '#287A4A', fontSize: 12, fontWeight: '700' },
  unavailableText: { marginTop: 4, color: '#A12032', fontSize: 12, fontWeight: '700' },
  sizeNotice: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#F4F1EE' },
  sizeNoticeTitle: { color: '#40342D', fontSize: 14, fontWeight: '800' },
  quantityRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D7CAC2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  stepperText: { color: '#3A2D26', fontSize: 22, fontWeight: '700' },
  quantityText: {
    minWidth: 28,
    textAlign: 'center',
    color: '#2D211B',
    fontSize: 17,
    fontWeight: '800',
  },
  primaryAction: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#8E3B46',
  },
  primaryActionDisabled: { opacity: 0.45 },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  dangerAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#A12032',
  },
  conflictCard: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: '#FFF0F1' },
  infoCard: { marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: '#F7F4F1' },
  warningBanner: { marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#FFF4D6' },
  warningText: { color: '#6E5314', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  errorBanner: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#FFF0F1' },
  errorText: { color: '#8B1E2D', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  successText: { marginTop: 14, color: '#287A4A', fontSize: 14, fontWeight: '800' },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFDFB',
  },
  stateTitle: { color: '#2D211B', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  stateCopy: { marginTop: 9, color: '#74675F', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  linkAction: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
  linkText: { color: '#8E3B46', fontSize: 15, fontWeight: '800' },
});
