import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  activeCustomerRoute,
  createInitialCustomerNavigationState,
  goBackCustomerNavigation,
  openCustomerRoute,
  selectCustomerTab,
  type CustomerNavigationState,
} from './customer-navigation-state';
import { CUSTOMER_TABS, type CustomerTabKey } from './customer-routes';

export interface CustomerRootNavigationSlots {
  readonly home: (openCheckout: () => void) => ReactNode;
  readonly discover: ReactNode;
  readonly style: ReactNode;
  readonly orders: ReactNode;
  readonly profile: ReactNode;
  readonly checkout: ReactNode;
}

export function CustomerRootNavigation({
  slots,
  initialState = createInitialCustomerNavigationState(),
}: {
  readonly slots: CustomerRootNavigationSlots;
  readonly initialState?: CustomerNavigationState;
}) {
  const [navigation, setNavigation] = useState(initialState);
  const activeRoute = activeCustomerRoute(navigation);
  const isCheckout = activeRoute.scope === 'TRANSACTION' && activeRoute.name === 'Checkout';

  const selectTab = (tab: CustomerTabKey): void => {
    setNavigation((current) => selectCustomerTab(current, tab));
  };

  const openCheckout = (): void => {
    setNavigation((current) =>
      openCustomerRoute(current, {
        scope: 'TRANSACTION',
        name: 'Checkout',
        params: undefined,
      }),
    );
  };

  const renderSelectedTab = (): ReactNode => {
    switch (navigation.selectedTab) {
      case 'Home':
        return slots.home(openCheckout);
      case 'Discover':
        return slots.discover;
      case 'Style':
        return slots.style;
      case 'Orders':
        return slots.orders;
      case 'Profile':
        return slots.profile;
    }
  };

  return (
    <View style={styles.root}>
      {isCheckout ? (
        <View style={styles.transactionHeader}>
          <Pressable
            accessibilityLabel="Back from checkout"
            accessibilityRole="button"
            onPress={() => {
              setNavigation((current) => goBackCustomerNavigation(current));
            }}
            style={styles.backAction}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.transactionTitle}>
            Checkout
          </Text>
        </View>
      ) : null}

      <View style={styles.content} testID="customer-root-route">
        {isCheckout ? slots.checkout : renderSelectedTab()}
      </View>

      {isCheckout ? null : (
        <View accessibilityLabel="Customer primary navigation" accessibilityRole="tablist" style={styles.tabs}>
          {CUSTOMER_TABS.map((tab) => {
            const selected = navigation.selectedTab === tab;
            return (
              <Pressable
                accessibilityLabel={`${tab} tab`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab}
                onPress={() => {
                  selectTab(tab);
                }}
                style={[styles.tab, selected ? styles.tabSelected : null]}
              >
                <Text style={selected ? styles.tabTextSelected : styles.tabText}>{tab}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function CustomerRootPlaceholder({ title, description }: { readonly title: string; readonly description: string }) {
  return (
    <View style={styles.placeholder}>
      <Text accessibilityRole="header" style={styles.placeholderTitle}>
        {title}
      </Text>
      <Text style={styles.placeholderDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { flex: 1 },
  transactionHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  backAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  backText: { color: '#6C3AA8', fontWeight: '700' },
  transactionTitle: { color: '#1D2939', fontSize: 18, fontWeight: '700' },
  tabs: {
    minHeight: 64,
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabSelected: { backgroundColor: '#EEE5FA' },
  tabText: { color: '#667085', fontSize: 12, fontWeight: '700' },
  tabTextSelected: { color: '#542887', fontSize: 12, fontWeight: '800' },
  placeholder: { flex: 1, justifyContent: 'center', padding: 24 },
  placeholderTitle: { color: '#1D2939', fontSize: 26, fontWeight: '700' },
  placeholderDescription: { marginTop: 10, color: '#667085', fontSize: 16, lineHeight: 24 },
});
