import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  SHOP_OPERATIONAL_STATUSES,
  type ShopOperationalStatus,
} from './merchant-shop-context.types';
import type {
  CustomerShopDetailCore,
  CustomerShopDetailQuery,
  CustomerShopHourRecord,
} from './customer-shop-detail.types';

export interface CustomerShopDetailGateway {
  findPublicShopDetail(
    client: SupabaseClient,
    query: CustomerShopDetailQuery,
  ): Promise<CustomerShopDetailCore | null>;

  listPublicShopHours(
    client: SupabaseClient,
    shopId: string,
  ): Promise<readonly CustomerShopHourRecord[]>;
}

export class CustomerShopDetailGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer shop-detail provider unavailable');
    this.name = 'CustomerShopDetailGatewayUnavailableError';
  }
}

export class CustomerShopDetailDataInvalidError extends Error {
  public constructor() {
    super('Customer shop-detail data invalid');
    this.name = 'CustomerShopDetailDataInvalidError';
  }
}

const SHOP_HOURS_SELECT = [
  'schedule_type',
  'day_of_week',
  'special_date',
  'open_time',
  'close_time',
  'is_closed',
].join(', ');

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?$/u;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);

  if (!Number.isFinite(value)) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireFiniteNumber(record, key);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value === 0) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requireNullableRating(record: Record<string, unknown>): number | null {
  const rawValue = record['rating_average'];

  if (rawValue === null) {
    return null;
  }

  const value = parseNumeric(rawValue);

  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function requireOperationalStatus(record: Record<string, unknown>): ShopOperationalStatus {
  const value = record['operational_status'];

  if (
    typeof value !== 'string' ||
    !SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value) ||
    value === 'PAUSED' ||
    value === 'SUSPENDED'
  ) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value as ShopOperationalStatus;
}

function requireNullableTime(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value.slice(0, 8);
}

function parseShopDetail(value: unknown): CustomerShopDetailCore {
  if (!isRecord(value)) {
    throw new CustomerShopDetailDataInvalidError();
  }

  const latitude = requireFiniteNumber(value, 'latitude');
  const longitude = requireFiniteNumber(value, 'longitude');
  const distanceMeters = requireNonNegativeInteger(value, 'distance_meters');
  const serviceRadiusMeters = requirePositiveInteger(value, 'service_radius_meters');
  const isServiceable = requireBoolean(value, 'is_serviceable');

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    isServiceable !== distanceMeters <= serviceRadiusMeters
  ) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    description: requireNullableString(value, 'description'),
    phoneNumber: requireString(value, 'phone_number'),
    email: requireNullableString(value, 'email'),
    latitude,
    longitude,
    operationalStatus: requireOperationalStatus(value),
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
    distanceMeters,
    serviceRadiusMeters,
    isServiceable,
    minimumOrderPaise: requireNonNegativeInteger(value, 'minimum_order_paise'),
    averagePreparationMinutes: requireNonNegativeInteger(value, 'average_preparation_minutes'),
    ratingAverage: requireNullableRating(value),
    ratingCount: requireNonNegativeInteger(value, 'rating_count'),
    followerCount: requireNonNegativeInteger(value, 'follower_count'),
  };
}

function parseHourRecord(value: unknown): CustomerShopHourRecord {
  if (!isRecord(value)) {
    throw new CustomerShopDetailDataInvalidError();
  }

  const scheduleType = value['schedule_type'];
  const rawDayOfWeek = value['day_of_week'];
  const specialDate = value['special_date'];
  const isClosed = requireBoolean(value, 'is_closed');
  const opensAt = requireNullableTime(value, 'open_time');
  const closesAt = requireNullableTime(value, 'close_time');

  if (scheduleType !== 'WEEKLY' && scheduleType !== 'SPECIAL_DATE') {
    throw new CustomerShopDetailDataInvalidError();
  }

  const dayOfWeek = rawDayOfWeek === null ? null : requireNonNegativeInteger(value, 'day_of_week');

  if (
    (dayOfWeek !== null && dayOfWeek > 6) ||
    (specialDate !== null &&
      (typeof specialDate !== 'string' || !DATE_PATTERN.test(specialDate))) ||
    (scheduleType === 'WEEKLY' && (dayOfWeek === null || specialDate !== null)) ||
    (scheduleType === 'SPECIAL_DATE' &&
      (dayOfWeek !== null || typeof specialDate !== 'string' || !DATE_PATTERN.test(specialDate))) ||
    (isClosed && (opensAt !== null || closesAt !== null)) ||
    (!isClosed && (opensAt === null || closesAt === null))
  ) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return {
    scheduleType,
    dayOfWeek,
    specialDate: typeof specialDate === 'string' ? specialDate : null,
    isClosed,
    opensAt,
    closesAt,
  };
}

function parseNullableShopDetail(value: unknown): CustomerShopDetailCore | null {
  if (value === null) {
    return null;
  }

  return parseShopDetail(value);
}

function parseHourRows(value: unknown): readonly CustomerShopHourRecord[] {
  if (!Array.isArray(value)) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value.map((row) => parseHourRecord(row));
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerShopDetailGatewayUnavailableError ||
    error instanceof CustomerShopDetailDataInvalidError
  ) {
    throw error;
  }

  throw new CustomerShopDetailGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerShopDetailGateway implements CustomerShopDetailGateway {
  public async findPublicShopDetail(
    client: SupabaseClient,
    query: CustomerShopDetailQuery,
  ): Promise<CustomerShopDetailCore | null> {
    try {
      const response = await client
        .rpc('get_public_shop_detail', {
          p_shop_id: query.shopId,
          p_latitude: query.latitude,
          p_longitude: query.longitude,
        })
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerShopDetailGatewayUnavailableError();
      }

      return parseNullableShopDetail(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async listPublicShopHours(
    client: SupabaseClient,
    shopId: string,
  ): Promise<readonly CustomerShopHourRecord[]> {
    try {
      const response = await client
        .from('shop_hours')
        .select(SHOP_HOURS_SELECT)
        .eq('shop_id', shopId)
        .order('schedule_type', { ascending: true })
        .order('day_of_week', { ascending: true })
        .order('special_date', { ascending: true });

      if (response.error !== null) {
        throw new CustomerShopDetailGatewayUnavailableError();
      }

      return parseHourRows(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
