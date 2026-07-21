import type {
  AccessRoute,
  CustomerRoute,
  CustomerTabKey,
  DiscoveryRoute,
  HomeRoute,
  OrdersRoute,
  ProfileRoute,
  StyleRoute,
  TransactionRoute,
} from './customer-routes';
import { ownerTabForRoute } from './customer-routes';

export interface CustomerNavigationState {
  readonly selectedTab: CustomerTabKey;
  readonly accessStack: readonly AccessRoute[];
  readonly homeStack: readonly HomeRoute[];
  readonly discoveryStack: readonly DiscoveryRoute[];
  readonly styleStack: readonly StyleRoute[];
  readonly ordersStack: readonly OrdersRoute[];
  readonly profileStack: readonly ProfileRoute[];
  readonly transactionStack: readonly TransactionRoute[];
}

export function createInitialCustomerNavigationState(): CustomerNavigationState {
  return {
    selectedTab: 'Home',
    accessStack: [{ scope: 'ACCESS', name: 'Splash', params: undefined }],
    homeStack: [{ scope: 'HOME', name: 'Home', params: undefined }],
    discoveryStack: [{ scope: 'DISCOVERY', name: 'Discover', params: undefined }],
    styleStack: [{ scope: 'STYLE', name: 'StyleHome', params: undefined }],
    ordersStack: [{ scope: 'ORDERS', name: 'Orders', params: undefined }],
    profileStack: [{ scope: 'PROFILE', name: 'Profile', params: undefined }],
    transactionStack: [],
  };
}

export function selectCustomerTab(
  state: CustomerNavigationState,
  selectedTab: CustomerTabKey,
): CustomerNavigationState {
  if (state.selectedTab === selectedTab && state.transactionStack.length === 0) {
    return state;
  }

  return {
    ...state,
    selectedTab,
    transactionStack: [],
  };
}

export function setAccessRoute(
  state: CustomerNavigationState,
  route: AccessRoute,
): CustomerNavigationState {
  return {
    ...state,
    accessStack: [route],
  };
}

export function openCustomerRoute(
  state: CustomerNavigationState,
  route: CustomerRoute,
): CustomerNavigationState {
  const ownerTab = ownerTabForRoute(route);

  switch (route.scope) {
    case 'ACCESS':
      return setAccessRoute(state, route);
    case 'HOME':
      return {
        ...state,
        selectedTab: ownerTab ?? state.selectedTab,
        homeStack: [...state.homeStack, route],
        transactionStack: [],
      };
    case 'DISCOVERY':
      return {
        ...state,
        selectedTab: ownerTab ?? state.selectedTab,
        discoveryStack: [...state.discoveryStack, route],
        transactionStack: [],
      };
    case 'STYLE':
      return {
        ...state,
        selectedTab: ownerTab ?? state.selectedTab,
        styleStack: [...state.styleStack, route],
        transactionStack: [],
      };
    case 'ORDERS':
      return {
        ...state,
        selectedTab: ownerTab ?? state.selectedTab,
        ordersStack: [...state.ordersStack, route],
        transactionStack: [],
      };
    case 'PROFILE':
      return {
        ...state,
        selectedTab: ownerTab ?? state.selectedTab,
        profileStack: [...state.profileStack, route],
        transactionStack: [],
      };
    case 'TRANSACTION':
      return {
        ...state,
        transactionStack: [...state.transactionStack, route],
      };
  }
}

function removeLast<Route>(routes: readonly Route[]): readonly Route[] {
  return routes.length > 1 ? routes.slice(0, -1) : routes;
}

export function goBackCustomerNavigation(state: CustomerNavigationState): CustomerNavigationState {
  if (state.transactionStack.length > 0) {
    return {
      ...state,
      transactionStack: state.transactionStack.slice(0, -1),
    };
  }

  switch (state.selectedTab) {
    case 'Home':
      return { ...state, homeStack: removeLast(state.homeStack) };
    case 'Discover':
      return { ...state, discoveryStack: removeLast(state.discoveryStack) };
    case 'Style':
      return { ...state, styleStack: removeLast(state.styleStack) };
    case 'Orders':
      return { ...state, ordersStack: removeLast(state.ordersStack) };
    case 'Profile':
      return { ...state, profileStack: removeLast(state.profileStack) };
  }
}

export function activeCustomerRoute(state: CustomerNavigationState): CustomerRoute {
  const transactionRoute = state.transactionStack.at(-1);
  if (transactionRoute !== undefined) {
    return transactionRoute;
  }

  switch (state.selectedTab) {
    case 'Home':
      return (
        state.homeStack.at(-1) ?? {
          scope: 'HOME',
          name: 'Home',
          params: undefined,
        }
      );
    case 'Discover':
      return (
        state.discoveryStack.at(-1) ?? {
          scope: 'DISCOVERY',
          name: 'Discover',
          params: undefined,
        }
      );
    case 'Style':
      return (
        state.styleStack.at(-1) ?? {
          scope: 'STYLE',
          name: 'StyleHome',
          params: undefined,
        }
      );
    case 'Orders':
      return (
        state.ordersStack.at(-1) ?? {
          scope: 'ORDERS',
          name: 'Orders',
          params: undefined,
        }
      );
    case 'Profile':
      return (
        state.profileStack.at(-1) ?? {
          scope: 'PROFILE',
          name: 'Profile',
          params: undefined,
        }
      );
  }
}
