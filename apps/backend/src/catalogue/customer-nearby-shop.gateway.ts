import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  SHOP_OPERATIONAL_STATUSES,
  type ShopOperationalStatus,
} from './merchant-shop-context.types';
import type {
  CustomerNearbyShopQuery,
  CustomerNearbyShopSnapshot,
} from './customer-nearby-shop.types';

export interface CustomerNearbyShopGateway {
  listServiceableShops(
    client: SupabaseClient,
    query: CustomerNearbyShopQuery,
  ): Promise<readonly CustomerNearbyShopSnapshot[]>;
}

export class CustomerNearbyShopGatewayUnavailableError extends Error {
  public constructor() {
    super('Nearby-shop provider unavailable');
    this.name = 'CustomerNearbyShopGatewayUnavailableError';
  }
}

export class CustomerNearbyShopDataInvalidError extends Error {
  public constructor() {
    super('Nearby-shop data invalid');
    this.name = 'CustomerNearbyShopDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerNearbyShopDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerNearbyShopDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerNearbyShopDataInvalidError();
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

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CustomerNearbyShopDataInvalidError();
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
    throw new CustomerNearbyShopDataInvalidError();
  }

  return value;
}

function requireOperationalStatus(record: Record<string, unknown>): ShopOperationalStatus {
  const value = record['operational_status'];

  if (
    typeof value !== 'string' ||
    !SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value)
  ) {
    throw new CustomerNearbyShopDataInvalidError();
  }

  return value as ShopOperationalStatus;
}

function parseNearbyShop(value: unknown): CustomerNearbyShopSnapshot {
  if (!isRecord(value)) {
    throw new CustomerNearbyShopDataInvalidError();
  }

  const distanceMeters = requireNonNegativeInteger(value, 'distance_meters');
  const serviceRadiusMeters = requireNonNegativeInteger(value, 'service_radius_meters');

  if (serviceRadiusMeters === 0 || distanceMeters > serviceRadiusMeters) {
    throw new CustomerNearbyShopDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    description: requireNullableString(value, 'description'),
    operationalStatus: requireOperationalStatus(value),
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
    distanceMeters,
    serviceRadiusMeters,
    minimumOrderPaise: requireNonNegativeInteger(value, 'minimum_order_paise'),
    averagePreparationMinutes: requireNonNegativeInteger(value, 'average_preparation_minutes'),
    ratingAverage: requireNullableRating(value),
    ratingCount: requireNonNegativeInteger(value, 'rating_count'),
    followerCount: requireNonNegativeInteger(value, 'follower_count'),
    isServiceable: true,
  };
}

function parseRows(value: unknown): readonly CustomerNearbyShopSnapshot[] {
  if (!Array.isArray(value)) {
    throw new CustomerNearbyShopDataInvalidError();
  }

  const shops = value.map((row) => parseNearbyShop(row));

  for (let index = 1; index < shops.length; index += 1) {
    const previous = shops[index - 1];
    const current = shops[index];

    if (
      previous === undefined ||
      current === undefined ||
      previous.distanceMeters > current.distanceMeters ||
      (previous.distanceMeters === current.distanceMeters &&
        previous.id.localeCompare(current.id) > 0)
    ) {
      throw new CustomerNearbyShopDataInvalidError();
    }
  }

  return shops;
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerNearbyShopGatewayUnavailableError ||
    error instanceof CustomerNearbyShopDataInvalidError
  ) {
    throw error;
  }

  throw new CustomerNearbyShopGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerNearbyShopGateway implements CustomerNearbyShopGateway {
  public async listServiceableShops(
    client: SupabaseClient,
    query: CustomerNearbyShopQuery,
  ): Promise<readonly CustomerNearbyShopSnapshot[]> {
    try {
      const response = await client.rpc('list_serviceable_shops', {
        p_latitude: query.latitude,
        p_longitude: query.longitude,
        p_limit: query.limit,
      });

      if (response.error !== null) {
        throw new CustomerNearbyShopGatewayUnavailableError();
      }

      return parseRows(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
