import type {
  AccountId,
  AuthorizationEpoch,
  LocationScopeId,
  NormalizedQueryFilters,
} from './types';

const customerRoot = (accountId: AccountId) => ['customer', accountId] as const;
const merchantRoot = (accountId: AccountId, shopId: string) =>
  ['merchant', accountId, shopId] as const;
const captainRoot = (accountId: AccountId) => ['captain', accountId] as const;
const adminRoot = (accountId: AccountId, authorizationEpoch: AuthorizationEpoch) =>
  ['admin', accountId, authorizationEpoch] as const;

export const customerKeys = {
  root: customerRoot,
  currentAccount: (accountId: AccountId) => [...customerRoot(accountId), 'currentAccount'] as const,
  home: (accountId: AccountId, locationScopeId: LocationScopeId) =>
    [...customerRoot(accountId), 'home', locationScopeId] as const,
  search: (
    accountId: AccountId,
    locationScopeId: LocationScopeId,
    filters: NormalizedQueryFilters,
  ) => [...customerRoot(accountId), 'search', locationScopeId, filters] as const,
  nearbyShops: (
    accountId: AccountId,
    locationScopeId: LocationScopeId,
    filters: NormalizedQueryFilters,
  ) => [...customerRoot(accountId), 'nearbyShops', locationScopeId, filters] as const,
  shop: (accountId: AccountId, locationScopeId: LocationScopeId, shopId: string) =>
    [...customerRoot(accountId), 'shop', locationScopeId, shopId] as const,
  shopProducts: (
    accountId: AccountId,
    locationScopeId: LocationScopeId,
    shopId: string,
    filters: NormalizedQueryFilters,
  ) => [...customerRoot(accountId), 'shopProducts', locationScopeId, shopId, filters] as const,
  product: (accountId: AccountId, locationScopeId: LocationScopeId, productId: string) =>
    [...customerRoot(accountId), 'product', locationScopeId, productId] as const,
  favouriteShops: (accountId: AccountId) =>
    [...customerRoot(accountId), 'favouriteShops'] as const,
  addresses: (accountId: AccountId) => [...customerRoot(accountId), 'addresses'] as const,
  address: (accountId: AccountId, addressId: string) =>
    [...customerRoot(accountId), 'address', addressId] as const,
  cart: (accountId: AccountId) => [...customerRoot(accountId), 'cart'] as const,
  checkoutQuotes: (accountId: AccountId) =>
    [...customerRoot(accountId), 'checkoutQuote'] as const,
  checkoutQuote: (accountId: AccountId, quoteId: string) =>
    [...customerRoot(accountId), 'checkoutQuote', quoteId] as const,
  orderLists: (accountId: AccountId) => [...customerRoot(accountId), 'orders'] as const,
  orders: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'orders', filters] as const,
  order: (accountId: AccountId, orderId: string) =>
    [...customerRoot(accountId), 'order', orderId] as const,
  returns: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'returns', filters] as const,
  returnDetail: (accountId: AccountId, returnId: string) =>
    [...customerRoot(accountId), 'return', returnId] as const,
  supportCases: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'supportCases', filters] as const,
  supportCase: (accountId: AccountId, caseId: string) =>
    [...customerRoot(accountId), 'supportCase', caseId] as const,
  wardrobe: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'wardrobe', filters] as const,
  wardrobeItem: (accountId: AccountId, itemId: string) =>
    [...customerRoot(accountId), 'wardrobeItem', itemId] as const,
  savedLooks: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'savedLooks', filters] as const,
  savedLook: (accountId: AccountId, lookId: string) =>
    [...customerRoot(accountId), 'savedLook', lookId] as const,
  groupStyleRooms: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...customerRoot(accountId), 'groupStyleRooms', filters] as const,
  groupStyleRoom: (accountId: AccountId, roomId: string) =>
    [...customerRoot(accountId), 'groupStyleRoom', roomId] as const,
} as const;

export const merchantKeys = {
  root: merchantRoot,
  currentAccount: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'currentAccount'] as const,
  dashboard: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'dashboard'] as const,
  orderQueues: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'orderQueue'] as const,
  orderQueue: (accountId: AccountId, shopId: string, filters: NormalizedQueryFilters) =>
    [...merchantRoot(accountId, shopId), 'orderQueue', filters] as const,
  orders: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'order'] as const,
  order: (accountId: AccountId, shopId: string, orderId: string) =>
    [...merchantRoot(accountId, shopId), 'order', orderId] as const,
  packingLists: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'packingList'] as const,
  packingList: (accountId: AccountId, shopId: string, orderId: string) =>
    [...merchantRoot(accountId, shopId), 'packingList', orderId] as const,
  alerts: (accountId: AccountId, shopId: string) =>
    [...merchantRoot(accountId, shopId), 'alert'] as const,
  alert: (accountId: AccountId, shopId: string, alertId: string) =>
    [...merchantRoot(accountId, shopId), 'alert', alertId] as const,
  inventory: (accountId: AccountId, shopId: string, filters: NormalizedQueryFilters) =>
    [...merchantRoot(accountId, shopId), 'inventory', filters] as const,
  inventoryItem: (accountId: AccountId, shopId: string, variantId: string) =>
    [...merchantRoot(accountId, shopId), 'inventoryItem', variantId] as const,
  returns: (accountId: AccountId, shopId: string, filters: NormalizedQueryFilters) =>
    [...merchantRoot(accountId, shopId), 'returns', filters] as const,
  returnDetail: (accountId: AccountId, shopId: string, returnId: string) =>
    [...merchantRoot(accountId, shopId), 'return', returnId] as const,
  supportCases: (accountId: AccountId, shopId: string, filters: NormalizedQueryFilters) =>
    [...merchantRoot(accountId, shopId), 'supportCases', filters] as const,
} as const;

export const captainKeys = {
  root: captainRoot,
  currentAccount: (accountId: AccountId) => [...captainRoot(accountId), 'currentAccount'] as const,
  availability: (accountId: AccountId) => [...captainRoot(accountId), 'availability'] as const,
  offers: (accountId: AccountId) => [...captainRoot(accountId), 'offers'] as const,
  activeDelivery: (accountId: AccountId) => [...captainRoot(accountId), 'activeDelivery'] as const,
  deliveries: (accountId: AccountId) => [...captainRoot(accountId), 'delivery'] as const,
  delivery: (accountId: AccountId, taskId: string) =>
    [...captainRoot(accountId), 'delivery', taskId] as const,
  history: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...captainRoot(accountId), 'history', filters] as const,
  earnings: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...captainRoot(accountId), 'earnings', filters] as const,
  supportCases: (accountId: AccountId, filters: NormalizedQueryFilters) =>
    [...captainRoot(accountId), 'supportCases', filters] as const,
} as const;

export const adminKeys = {
  root: adminRoot,
  dashboard: (accountId: AccountId, authorizationEpoch: AuthorizationEpoch) =>
    [...adminRoot(accountId, authorizationEpoch), 'dashboard'] as const,
  collections: (
    accountId: AccountId,
    authorizationEpoch: AuthorizationEpoch,
    resource: string,
  ) => [...adminRoot(accountId, authorizationEpoch), 'collection', resource] as const,
  collection: (
    accountId: AccountId,
    authorizationEpoch: AuthorizationEpoch,
    resource: string,
    filters: NormalizedQueryFilters,
  ) => [...adminRoot(accountId, authorizationEpoch), 'collection', resource, filters] as const,
  details: (accountId: AccountId, authorizationEpoch: AuthorizationEpoch, resource: string) =>
    [...adminRoot(accountId, authorizationEpoch), 'detail', resource] as const,
  detail: (
    accountId: AccountId,
    authorizationEpoch: AuthorizationEpoch,
    resource: string,
    resourceId: string,
  ) => [...adminRoot(accountId, authorizationEpoch), 'detail', resource, resourceId] as const,
  audits: (accountId: AccountId, authorizationEpoch: AuthorizationEpoch) =>
    [...adminRoot(accountId, authorizationEpoch), 'audit'] as const,
  audit: (
    accountId: AccountId,
    authorizationEpoch: AuthorizationEpoch,
    filters: NormalizedQueryFilters,
  ) => [...adminRoot(accountId, authorizationEpoch), 'audit', filters] as const,
} as const;

export const mutationKeys = {
  customer: (accountId: AccountId, resource: string, command: string) =>
    [...customerRoot(accountId), 'mutation', resource, command] as const,
  merchant: (
    accountId: AccountId,
    shopId: string,
    resource: string,
    command: string,
  ) => [...merchantRoot(accountId, shopId), 'mutation', resource, command] as const,
  captain: (accountId: AccountId, resource: string, command: string) =>
    [...captainRoot(accountId), 'mutation', resource, command] as const,
  admin: (
    accountId: AccountId,
    authorizationEpoch: AuthorizationEpoch,
    resource: string,
    command: string,
  ) => [...adminRoot(accountId, authorizationEpoch), 'mutation', resource, command] as const,
} as const;
