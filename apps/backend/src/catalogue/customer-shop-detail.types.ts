import type { ShopOperationalStatus } from './merchant-shop-context.types';

export const CUSTOMER_SHOP_ORDERING_STATUSES = [
  'ACCEPTING_ORDERS',
  'BUSY',
  'CLOSED',
  'OUTSIDE_SERVICE_AREA',
  'ONLINE_ORDERS_DISABLED',
] as const;

export type CustomerShopOrderingStatus = (typeof CUSTOMER_SHOP_ORDERING_STATUSES)[number];

export type CustomerShopHourSource = 'WEEKLY' | 'SPECIAL_DATE' | 'NONE';

export interface CustomerShopDetailQuery {
  readonly shopId: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerShopLocationSnapshot {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CustomerShopServiceabilitySnapshot {
  readonly customerLatitude: number;
  readonly customerLongitude: number;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
  readonly isServiceable: boolean;
}

export interface CustomerShopWeeklyHoursSnapshot {
  readonly dayOfWeek: number;
  readonly isClosed: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

export interface CustomerShopTodayHoursSnapshot {
  readonly date: string;
  readonly dayOfWeek: number;
  readonly timeZone: 'Asia/Kolkata';
  readonly source: CustomerShopHourSource;
  readonly isClosed: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly isOpenNow: boolean;
}

export interface CustomerShopDetailSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly phoneNumber: string;
  readonly email: string | null;
  readonly location: CustomerShopLocationSnapshot;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly orderingStatus: CustomerShopOrderingStatus;
  readonly canPlaceOrder: boolean;
  readonly serviceability: CustomerShopServiceabilitySnapshot;
  readonly todayHours: CustomerShopTodayHoursSnapshot;
  readonly weeklyHours: readonly CustomerShopWeeklyHoursSnapshot[];
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
}

export interface CustomerShopDetailCore {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly phoneNumber: string;
  readonly email: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly operationalStatus: ShopOperationalStatus;
  readonly acceptsOnlineOrders: boolean;
  readonly distanceMeters: number;
  readonly serviceRadiusMeters: number;
  readonly isServiceable: boolean;
  readonly minimumOrderPaise: number;
  readonly averagePreparationMinutes: number;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly followerCount: number;
}

export interface CustomerShopHourRecord {
  readonly scheduleType: 'WEEKLY' | 'SPECIAL_DATE';
  readonly dayOfWeek: number | null;
  readonly specialDate: string | null;
  readonly isClosed: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface GetCustomerShopDetailResponse {
  readonly success: true;
  readonly data: {
    readonly shop: CustomerShopDetailSnapshot;
  };
  readonly meta: ResponseMeta;
}
