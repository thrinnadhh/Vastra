import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  PRODUCT_GENDER_CATEGORIES,
  type ProductGenderCategory,
} from './merchant-product.types';
import {
  SHOP_OPERATIONAL_STATUSES,
  type ShopOperationalStatus,
} from './merchant-shop-context.types';
import type {
  CustomerFavouriteShopSnapshot,
  CustomerPreferencesSnapshot,
  ReplaceCustomerPreferencesInput,
} from './customer-preference.types';

const PREFERENCE_SELECT = [
  'gender_categories',
  'style_tags',
  'occasion_tags',
  'preferred_colours',
  'preferred_sizes',
  'min_price_paise',
  'max_price_paise',
  'updated_at',
].join(', ');

export interface CustomerPreferenceGateway {
  listFavouriteShops(client: SupabaseClient): Promise<readonly CustomerFavouriteShopSnapshot[]>;
  setFavouriteShop(
    client: SupabaseClient,
    shopId: string,
    favourite: boolean,
  ): Promise<{ readonly shopId: string; readonly isFavourite: boolean }>;
  getPreferences(
    client: SupabaseClient,
    customerId: string,
  ): Promise<CustomerPreferencesSnapshot>;
  replacePreferences(
    client: SupabaseClient,
    customerId: string,
    input: ReplaceCustomerPreferencesInput,
  ): Promise<CustomerPreferencesSnapshot>;
}

export class CustomerPreferenceGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer preference provider unavailable');
    this.name = 'CustomerPreferenceGatewayUnavailableError';
  }
}

export class CustomerPreferenceDataInvalidError extends Error {
  public constructor() {
    super('Customer preference data invalid');
    this.name = 'CustomerPreferenceDataInvalidError';
  }
}

export class CustomerFavouriteShopNotFoundError extends Error {
  public constructor() {
    super('Favourite shop not found');
    this.name = 'CustomerFavouriteShopNotFoundError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerPreferenceDataInvalidError();
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
    throw new CustomerPreferenceDataInvalidError();
  }

  return value;
}

function requireNullableNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  return requireNonNegativeInteger(record, key);
}

function requireNullableRating(record: Record<string, unknown>): number | null {
  if (record['rating_average'] === null) {
    return null;
  }

  const value = parseNumeric(record['rating_average']);

  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value;
}

function requireOperationalStatus(record: Record<string, unknown>): ShopOperationalStatus {
  const value = record['operational_status'];

  if (
    typeof value !== 'string' ||
    !SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value)
  ) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value as ShopOperationalStatus;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value;
}

function requireNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  if (record[key] === null) {
    return null;
  }

  return requireTimestamp(record, key);
}

function requireTextArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value as readonly string[];
}

function requireGenderCategories(
  record: Record<string, unknown>,
): readonly ProductGenderCategory[] {
  const value = requireTextArray(record, 'gender_categories');

  if (
    value.some(
      (item) => !PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === item),
    )
  ) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value as readonly ProductGenderCategory[];
}

function parseFavouriteShop(value: unknown): CustomerFavouriteShopSnapshot {
  if (!isRecord(value)) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return {
    id: requireString(value, 'shop_id'),
    name: requireString(value, 'shop_name'),
    slug: requireString(value, 'shop_slug'),
    logoObjectKey: requireNullableString(value, 'logo_object_key'),
    coverImageObjectKey: requireNullableString(value, 'cover_image_object_key'),
    operationalStatus: requireOperationalStatus(value),
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
    ratingAverage: requireNullableRating(value),
    ratingCount: requireNonNegativeInteger(value, 'rating_count'),
    followerCount: requireNonNegativeInteger(value, 'follower_count'),
    favouritedAt: requireTimestamp(value, 'favourited_at'),
  };
}

function parseFavouriteRows(value: unknown): readonly CustomerFavouriteShopSnapshot[] {
  if (!Array.isArray(value)) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return value.map((row) => parseFavouriteShop(row));
}

function parseFavouriteMutation(
  value: unknown,
): { readonly shopId: string; readonly isFavourite: boolean } {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return {
    shopId: requireString(value[0], 'shop_id'),
    isFavourite: requireBoolean(value[0], 'is_favourite'),
  };
}

function createDefaultPreferences(): CustomerPreferencesSnapshot {
  return {
    genderCategories: [],
    styleTags: [],
    occasionTags: [],
    preferredColours: [],
    preferredSizes: [],
    minPricePaise: null,
    maxPricePaise: null,
    updatedAt: null,
  };
}

function parsePreferences(value: unknown): CustomerPreferencesSnapshot {
  if (!isRecord(value)) {
    throw new CustomerPreferenceDataInvalidError();
  }

  const minPricePaise = requireNullableNonNegativeInteger(value, 'min_price_paise');
  const maxPricePaise = requireNullableNonNegativeInteger(value, 'max_price_paise');

  if (
    minPricePaise !== null &&
    maxPricePaise !== null &&
    minPricePaise > maxPricePaise
  ) {
    throw new CustomerPreferenceDataInvalidError();
  }

  return {
    genderCategories: requireGenderCategories(value),
    styleTags: requireTextArray(value, 'style_tags'),
    occasionTags: requireTextArray(value, 'occasion_tags'),
    preferredColours: requireTextArray(value, 'preferred_colours'),
    preferredSizes: requireTextArray(value, 'preferred_sizes'),
    minPricePaise,
    maxPricePaise,
    updatedAt: requireNullableTimestamp(value, 'updated_at'),
  };
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerPreferenceGatewayUnavailableError ||
    error instanceof CustomerPreferenceDataInvalidError ||
    error instanceof CustomerFavouriteShopNotFoundError
  ) {
    throw error;
  }

  throw new CustomerPreferenceGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerPreferenceGateway implements CustomerPreferenceGateway {
  public async listFavouriteShops(
    client: SupabaseClient,
  ): Promise<readonly CustomerFavouriteShopSnapshot[]> {
    try {
      const response = await client.rpc('list_customer_favourite_shops', {});

      if (response.error !== null) {
        throw new CustomerPreferenceGatewayUnavailableError();
      }

      return parseFavouriteRows(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async setFavouriteShop(
    client: SupabaseClient,
    shopId: string,
    favourite: boolean,
  ): Promise<{ readonly shopId: string; readonly isFavourite: boolean }> {
    try {
      const response = await client.rpc('set_customer_favourite_shop', {
        p_shop_id: shopId,
        p_favourite: favourite,
      });

      if (response.error !== null) {
        if (response.error.code === 'P0002') {
          throw new CustomerFavouriteShopNotFoundError();
        }

        throw new CustomerPreferenceGatewayUnavailableError();
      }

      return parseFavouriteMutation(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async getPreferences(
    client: SupabaseClient,
    customerId: string,
  ): Promise<CustomerPreferencesSnapshot> {
    try {
      const response = await client
        .from('customer_preferences')
        .select(PREFERENCE_SELECT)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerPreferenceGatewayUnavailableError();
      }

      if (response.data === null) {
        return createDefaultPreferences();
      }

      return parsePreferences(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async replacePreferences(
    client: SupabaseClient,
    customerId: string,
    input: ReplaceCustomerPreferencesInput,
  ): Promise<CustomerPreferencesSnapshot> {
    try {
      const response = await client
        .from('customer_preferences')
        .upsert(
          {
            customer_id: customerId,
            gender_categories: [...input.genderCategories],
            style_tags: [...input.styleTags],
            occasion_tags: [...input.occasionTags],
            preferred_colours: [...input.preferredColours],
            preferred_sizes: [...input.preferredSizes],
            min_price_paise: input.minPricePaise,
            max_price_paise: input.maxPricePaise,
          },
          { onConflict: 'customer_id' },
        )
        .select(PREFERENCE_SELECT)
        .single();

      if (response.error !== null) {
        throw new CustomerPreferenceGatewayUnavailableError();
      }

      return parsePreferences(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
