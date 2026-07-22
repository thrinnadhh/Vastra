import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { parseCustomerDeepLink, type CustomerDeepLinkResult } from './customer-deep-link';
import type { CustomerLinkingPort } from './customer-linking.port';
import {
  activeCustomerRoute,
  createInitialCustomerNavigationState,
  goBackCustomerNavigation,
  openCustomerRoute,
  selectCustomerTab,
  type CustomerNavigationState,
} from './customer-navigation-state';
import { CUSTOMER_TABS, type CustomerRoute, type CustomerTabKey } from './customer-routes';

export interface CustomerHomeNavigationActions {
  readonly openCheckout: () => void;
  readonly openDiscover: () => void;
}

export interface CustomerRootNavigationSlots {
  readonly home: (actions: CustomerHomeNavigationActions) => ReactNode;
  readonly discover: ReactNode;
  readonly style: ReactNode;
  readonly orders: ReactNode;
  readonly profile: ReactNode;
  readonly checkout: ReactNode;
  readonly renderDeepLinkedRoute?: (route: CustomerRoute, onBack: () => void) => ReactNode | null;
}

type LinkFailureKind = Exclude<CustomerDeepLinkResult['kind'], 'ROUTE'>;

function customerLinkFailureCopy(kind: LinkFailureKind): string {
  switch (kind) {
    case 'WRONG_APPLICATION':
      return 'This link belongs to another Vastra application.';
    case 'RESERVED':
      return 'This Vastra link is not available in the current release.';
    case 'INVALID':
      return 'This Vastra link is invalid or is no longer supported.';
  }
}

export function CustomerRootNavigation({
  slots,
  initialState = createInitialCustomerNavigationState(),
  linkingPort,
}: {
  readonly slots: CustomerRootNavigationSlots;
  readonly initialState?: CustomerNavigationState;
  readonly linkingPort?: CustomerLinkingPort;
}) {
  const [navigation, setNavigation] = useState(initialState);
  const [linkFailure, setLinkFailure] = useState<LinkFailureKind | null>(null);
  const activeRoute = activeCustomerRoute(navigation);
  const isCheckout = activeRoute.scope === 'TRANSACTION' && activeRoute.name === 'Checkout';

  const selectTab = (tab: CustomerTabKey): void => {
    setLinkFailure(null);
    setNavigation((current) => selectCustomerTab(current, tab));
  };

  const openCheckout = (): void => {
    setLinkFailure(null);
    setNavigation((current) =>
      openCustomerRoute(current, {
        scope: 'TRANSACTION',
        name: 'Checkout',
        params: undefined,
      }),
    );
  };

  const openDiscover = (): void => {
    selectTab('Discover');
  };

  const goBack = useCallback((): void => {
    setLinkFailure(null);
    setNavigation((current) => goBackCustomerNavigation(current));
  }, []);

  const applyIncomingUrl = useCallback((url: string): void => {
    const result = parseCustomerDeepLink(url);
    if (result.kind === 'ROUTE') {
      setLinkFailure(null);
      setNavigation((current) => openCustomerRoute(current, result.route));
      return;
    }

    setLinkFailure(result.kind);
  }, []);

  useEffect(() => {
    if (linkingPort === undefined) {
      return undefined;
    }

    let mounted = true;
    const unsubscribe = linkingPort.subscribe((url) => {
      if (mounted) {
        applyIncomingUrl(url);
      }
    });

    void linkingPort
      .getInitialUrl()
      .then((url) => {
        if (mounted && url !== null) {
          applyIncomingUrl(url);
        }
      })
      .catch(() => {
        if (mounted) {
          setLinkFailure('INVALID');
        }
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyIncomingUrl, linkingPort]);

  const renderSelectedTab = (): ReactNode => {
    switch (navigation.selectedTab) {
      case 'Home':
        return slots.home({ openCheckout, openDiscover });
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

  if (linkFailure !== null) {
    return (
      <View style={styles.linkFailure}>
        <Text accessibilityRole="header" style={styles.placeholderTitle}>
          Link unavailable
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.placeholderDescription}>
          {customerLinkFailureCopy(linkFailure)}
        </Text>
        <Pressable
          accessibilityLabel="Return safely"
          accessibilityRole="button"
          onPress={() => {
            setLinkFailure(null);
          }}
          style={styles.linkFailureAction}
        >
          <Text style={styles.linkFailureActionText}>Return safely</Text>
        </Pressable>
      </View>
    );
  }

  const deepLinkedContent =
    !isCheckout && slots.renderDeepLinkedRoute !== undefined
      ? slots.renderDeepLinkedRoute(activeRoute, goBack)
      : null;

  return (
    <View style={styles.root}>
      {isCheckout ? (
        <View style={styles.transactionHeader}>
          <Pressable
            accessibilityLabel="Back from checkout"
            accessibilityRole="button"
            onPress={goBack}
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
        {isCheckout ? slots.checkout : (deepLinkedContent ?? renderSelectedTab())}
      </View>

      {isCheckout || deepLinkedContent !== null ? null : (
        <View
          accessibilityLabel="Customer primary navigation"
          accessibilityRole="tablist"
          style={styles.tabs}
        >
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

export function CustomerRootPlaceholder({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
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
  linkFailure: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF8F2',
  },
  linkFailureAction: {
    minHeight: 48,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#8E3B46',
  },
  linkFailureActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});