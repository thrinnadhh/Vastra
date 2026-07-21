export const CUSTOMER_TABS = ['Home', 'Discover', 'Style', 'Orders', 'Profile'] as const;

export type CustomerTabKey = (typeof CUSTOMER_TABS)[number];

export type UUID = string & { readonly __brand: 'UUID' };
export type LegalDocumentKey = string & { readonly __brand: 'LegalDocumentKey' };
export type SensitiveIngressHandle = string & { readonly __brand: 'SensitiveIngressHandle' };

export interface CustomerTabParamList {
  readonly Home: undefined;
  readonly Discover: undefined;
  readonly Style: undefined;
  readonly Orders: undefined;
  readonly Profile: undefined;
}

export interface AccessFlowParamList {
  readonly Splash: undefined;
  readonly PhoneLogin: undefined;
  readonly OtpVerification: undefined;
  readonly ProfileSetup: undefined;
  readonly LocationAccess: undefined;
  readonly ManualLocation:
    | {
        readonly reason?: 'PERMISSION_DENIED' | 'GPS_DISABLED' | 'OUTSIDE_SERVICE_AREA';
      }
    | undefined;
}

export interface HomeStackParamList {
  readonly Home: undefined;
}

export interface DiscoveryStackParamList {
  readonly Discover: undefined;
  readonly Search: { readonly initialQuery?: string } | undefined;
  readonly SearchResults: { readonly query: string };
  readonly Filters: { readonly source: 'SEARCH_RESULTS' | 'SHOP_PRODUCTS' | 'CATEGORY' };
  readonly Categories: undefined;
  readonly NearbyShops: undefined;
  readonly ShopDetail: { readonly shopId: UUID };
  readonly ProductDetail: { readonly productId: UUID };
  readonly SizeChart: { readonly productId: UUID };
  readonly FavouriteShops: undefined;
}

export type AddressListParams =
  | { readonly mode: 'MANAGE' }
  | { readonly mode: 'SELECT_FOR_CHECKOUT'; readonly returnTo: 'Checkout' };

export type AddressFormParams =
  | { readonly mode: 'CREATE'; readonly purpose: 'MANAGE' | 'CHECKOUT' }
  | {
      readonly mode: 'EDIT';
      readonly purpose: 'MANAGE' | 'CHECKOUT';
      readonly addressId: UUID;
    };

export interface TransactionStackParamList {
  readonly Cart: undefined;
  readonly AddressList: AddressListParams;
  readonly AddressForm: AddressFormParams;
  readonly Checkout: { readonly addressId?: UUID } | undefined;
  readonly Payment: undefined;
  readonly OrderConfirmation: { readonly orderId: UUID };
}

export interface OrdersStackParamList {
  readonly Orders: undefined;
  readonly OrderDetail: { readonly orderId: UUID };
  readonly OrderTracking: { readonly orderId: UUID };
  readonly CancelOrder: { readonly orderId: UUID };
  readonly ReturnRequest: { readonly orderId: UUID };
  readonly ReturnStatus: { readonly returnId: UUID };
  readonly Rating: { readonly orderId: UUID };
}

export interface ProfileStackParamList {
  readonly Profile: undefined;
  readonly ProfileEdit: undefined;
  readonly Preferences: undefined;
  readonly NotificationSettings: undefined;
  readonly SupportTickets: { readonly orderId?: UUID } | undefined;
  readonly SupportConversation: { readonly supportCaseId: UUID };
  readonly Legal: { readonly document: LegalDocumentKey };
  readonly AccountDeletion: undefined;
}

export type WardrobeItemFormParams =
  | { readonly mode: 'CREATE' }
  | { readonly mode: 'EDIT'; readonly wardrobeItemId: UUID };

export type LookFormParams =
  | { readonly mode: 'CREATE' }
  | { readonly mode: 'EDIT'; readonly lookId: UUID };

export type GroupStyleJoinParams =
  | { readonly method: 'LINK'; readonly ingressHandle: SensitiveIngressHandle }
  | { readonly method: 'JOIN_CODE_ENTRY' };

export interface StyleStackParamList {
  readonly StyleHome: undefined;
  readonly Wardrobe: undefined;
  readonly WardrobeItemForm: WardrobeItemFormParams;
  readonly WardrobeItem: { readonly wardrobeItemId: UUID };
  readonly SavedLooks: undefined;
  readonly LookForm: LookFormParams;
  readonly LookDetail: { readonly lookId: UUID };
  readonly GroupStyleRooms: undefined;
  readonly GroupStyleCreate: undefined;
  readonly GroupStyleJoin: GroupStyleJoinParams;
  readonly GroupStyleRoom: { readonly roomId: UUID };
  readonly GroupStyleMembers: { readonly roomId: UUID };
  readonly GroupStyleReport: {
    readonly roomId: UUID;
    readonly shareId?: UUID;
    readonly commentId?: UUID;
  };
}

export type CustomerRouteScope =
  | 'ACCESS'
  | 'HOME'
  | 'DISCOVERY'
  | 'STYLE'
  | 'ORDERS'
  | 'PROFILE'
  | 'TRANSACTION';

type RouteUnion<Scope extends CustomerRouteScope, Params extends object> = {
  readonly [Name in keyof Params]: {
    readonly scope: Scope;
    readonly name: Name;
    readonly params: Params[Name];
  };
}[keyof Params];

export type AccessRoute = RouteUnion<'ACCESS', AccessFlowParamList>;
export type HomeRoute = RouteUnion<'HOME', HomeStackParamList>;
export type DiscoveryRoute = RouteUnion<'DISCOVERY', DiscoveryStackParamList>;
export type StyleRoute = RouteUnion<'STYLE', StyleStackParamList>;
export type OrdersRoute = RouteUnion<'ORDERS', OrdersStackParamList>;
export type ProfileRoute = RouteUnion<'PROFILE', ProfileStackParamList>;
export type TransactionRoute = RouteUnion<'TRANSACTION', TransactionStackParamList>;

export type CustomerRoute =
  | AccessRoute
  | HomeRoute
  | DiscoveryRoute
  | StyleRoute
  | OrdersRoute
  | ProfileRoute
  | TransactionRoute;

export const CUSTOMER_SCOPE_OWNERS: Readonly<Record<CustomerRouteScope, CustomerTabKey | null>> =
  Object.freeze({
    ACCESS: null,
    HOME: 'Home',
    DISCOVERY: 'Discover',
    STYLE: 'Style',
    ORDERS: 'Orders',
    PROFILE: 'Profile',
    TRANSACTION: null,
  });

export function isCustomerTabKey(value: string): value is CustomerTabKey {
  return (CUSTOMER_TABS as readonly string[]).includes(value);
}

export function isUuid(value: string): value is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

export function ownerTabForRoute(route: CustomerRoute): CustomerTabKey | null {
  return CUSTOMER_SCOPE_OWNERS[route.scope];
}
