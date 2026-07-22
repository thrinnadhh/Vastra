import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  CustomerFavouriteFailureKind,
  CustomerFavouriteShop,
  CustomerFavouriteState,
} from './customer-favourite.types';

interface CustomerFavouriteShopsScreenProps {
  readonly state: CustomerFavouriteState;
  readonly onRefresh: () => void;
  readonly onRemove: (shopId: string) => void;
  readonly onBrowseShops: () => void;
}

function failureCopy(kind: CustomerFavouriteFailureKind): string {
  if (kind === 'OFFLINE') return 'You are offline. Reconnect to refresh favourite shops.';
  if (kind === 'NOT_FOUND') return 'One of the favourite shops is no longer customer-visible.';
  return 'Favourite shops could not be refreshed. Try again.';
}

function ratingCopy(shop: CustomerFavouriteShop): string {
  if (shop.ratingAverage === null || shop.ratingCount === 0) return 'No ratings yet';
  return `${shop.ratingAverage.toFixed(1)} from ${String(shop.ratingCount)} rating${
    shop.ratingCount === 1 ? '' : 's'
  }`;
}

export function CustomerFavouriteShopsScreen({
  state,
  onRefresh,
  onRemove,
  onBrowseShops,
}: CustomerFavouriteShopsScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} testID="customer-favourite-shops-scroll">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SAVED LOCALLY</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Favourite shops
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh favourite shops"
          accessibilityRole="button"
          disabled={state.isLoading}
          onPress={onRefresh}
          style={styles.refreshAction}
        >
          <Text style={styles.refreshText}>{state.isLoading ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>

      {state.isStale ? (
        <View accessibilityLiveRegion="polite" style={styles.warningCard}>
          <Text style={styles.warningText}>
            Showing the last successful favourite list because the latest refresh failed.
          </Text>
        </View>
      ) : null}

      {state.failureKind === null ? null : (
        <View accessibilityLiveRegion="assertive" style={styles.errorCard}>
          <Text style={styles.errorText}>{failureCopy(state.failureKind)}</Text>
        </View>
      )}

      {state.statusMessage === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.statusText}>
          {state.statusMessage}
        </Text>
      )}

      {state.isLoading && state.shops.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading favourites…</Text>
          <Text style={styles.stateCopy}>Requesting your authoritative saved-shop list.</Text>
        </View>
      ) : null}

      {!state.isLoading && state.shops.length === 0 ? (
        <View style={styles.stateCard}>
          <Text accessibilityRole="header" style={styles.stateTitle}>
            No favourite shops yet
          </Text>
          <Text style={styles.stateCopy}>
            Open a nearby shop and save it here. Favourites are private to your customer account.
          </Text>
          <Pressable
            accessibilityLabel="Browse nearby shops from favourites"
            accessibilityRole="button"
            onPress={onBrowseShops}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Browse nearby shops</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.list}>
        {state.shops.map((shop) => {
          const pending = state.pendingShopIds.has(shop.id);
          return (
            <View key={shop.id} style={styles.shopCard} testID={`favourite-shop-${shop.id}`}>
              <View style={styles.shopInitial}>
                <Text style={styles.shopInitialText}>{shop.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.shopBody}>
                <Text numberOfLines={1} style={styles.shopName}>
                  {shop.name}
                </Text>
                <Text style={styles.metaText}>{ratingCopy(shop)}</Text>
                <Text style={styles.metaText}>{String(shop.followerCount)} followers</Text>
                <Text
                  style={
                    shop.acceptsOnlineOrders && shop.operationalStatus === 'OPEN'
                      ? styles.availableText
                      : styles.unavailableText
                  }
                >
                  {shop.acceptsOnlineOrders && shop.operationalStatus === 'OPEN'
                    ? 'Accepting online orders'
                    : `Ordering unavailable · ${shop.operationalStatus}`}
                </Text>
                <Pressable
                  accessibilityLabel={`Remove ${shop.name} from favourites`}
                  accessibilityRole="button"
                  disabled={pending}
                  onPress={() => {
                    onRemove(shop.id);
                  }}
                  style={[styles.removeAction, pending ? styles.actionDisabled : null]}
                >
                  <Text style={styles.removeText}>
                    {pending ? 'Removing…' : 'Remove favourite'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, backgroundColor: '#FFFDFB' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: '#8E3B46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 5, color: '#241B16', fontSize: 28, fontWeight: '800' },
  refreshAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  refreshText: { color: '#8E3B46', fontSize: 14, fontWeight: '800' },
  warningCard: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFF4D6' },
  warningText: { color: '#6E5314', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  errorCard: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFF0F1' },
  errorText: { color: '#8B1E2D', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  statusText: { marginTop: 12, color: '#287A4A', fontSize: 14, fontWeight: '800' },
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  list: { gap: 12, marginTop: 20 },
  shopCard: {
    minHeight: 142,
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
  shopName: { color: '#2D211B', fontSize: 17, fontWeight: '800' },
  metaText: { marginTop: 4, color: '#70635B', fontSize: 13 },
  availableText: { marginTop: 5, color: '#287A4A', fontSize: 13, fontWeight: '700' },
  unavailableText: { marginTop: 5, color: '#A12032', fontSize: 13, fontWeight: '700' },
  removeAction: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 12,
  },
  removeText: { color: '#8E3B46', fontSize: 13, fontWeight: '800' },
  actionDisabled: { opacity: 0.5 },
});
