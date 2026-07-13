import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import {
  SHOP_OPERATIONAL_STATUSES,
  SHOP_VERIFICATION_STATUSES,
  type MerchantCatalogueShopSnapshot,
  type ShopOperationalStatus,
  type ShopVerificationStatus,
} from './merchant-shop-context.types';

export interface MerchantShopContextGateway {
  findOwnedShops(
    client: SupabaseClient,
    merchantId: string,
  ): Promise<readonly MerchantCatalogueShopSnapshot[]>;

  findOwnedShopById(
    client: SupabaseClient,
    merchantId: string,
    shopId: string,
  ): Promise<MerchantCatalogueShopSnapshot | null>;
}

export class MerchantShopContextGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant shop context provider unavailable');
    this.name = 'MerchantShopContextGatewayUnavailableError';
  }
}

export class MerchantShopContextDataInvalidError extends Error {
  public constructor() {
    super('Merchant shop context data invalid');
    this.name = 'MerchantShopContextDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantShopContextDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantShopContextDataInvalidError();
  }

  return value;
}

function requireSafeNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const rawValue = record[key];
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim().length > 0
        ? Number(rawValue)
        : Number.NaN;

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MerchantShopContextDataInvalidError();
  }

  return value;
}

function isShopVerificationStatus(value: unknown): value is ShopVerificationStatus {
  return (
    typeof value === 'string' && SHOP_VERIFICATION_STATUSES.some((candidate) => candidate === value)
  );
}

function isShopOperationalStatus(value: unknown): value is ShopOperationalStatus {
  return (
    typeof value === 'string' && SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value)
  );
}

function parseMerchantShop(value: unknown): MerchantCatalogueShopSnapshot {
  if (!isRecord(value)) {
    throw new MerchantShopContextDataInvalidError();
  }

  const verificationStatus = value['verification_status'];
  const operationalStatus = value['operational_status'];

  if (
    !isShopVerificationStatus(verificationStatus) ||
    !isShopOperationalStatus(operationalStatus)
  ) {
    throw new MerchantShopContextDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopCode: requireString(value, 'shop_code'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    verificationStatus,
    operationalStatus,
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
    serviceRadiusMeters: requireSafeNonNegativeInteger(value, 'service_radius_meters'),
    minimumOrderPaise: requireSafeNonNegativeInteger(value, 'minimum_order_paise'),
    averagePreparationMinutes: requireSafeNonNegativeInteger(value, 'average_preparation_minutes'),
    createdAt: requireString(value, 'created_at'),
    updatedAt: requireString(value, 'updated_at'),
  };
}

function parseMerchantShops(value: unknown): readonly MerchantCatalogueShopSnapshot[] {
  if (!Array.isArray(value)) {
    throw new MerchantShopContextDataInvalidError();
  }

  return value.map((shop) => parseMerchantShop(shop));
}

function parseNullableMerchantShop(value: unknown): MerchantCatalogueShopSnapshot | null {
  if (value === null) {
    return null;
  }

  return parseMerchantShop(value);
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantShopContextGatewayUnavailableError ||
    error instanceof MerchantShopContextDataInvalidError
  ) {
    throw error;
  }

  throw new MerchantShopContextGatewayUnavailableError();
}

const SHOP_SELECT = [
  'id',
  'shop_code',
  'name',
  'slug',
  'verification_status',
  'operational_status',
  'accepts_online_orders',
  'service_radius_meters',
  'minimum_order_paise',
  'average_preparation_minutes',
  'created_at',
  'updated_at',
].join(', ');

@Injectable()
export class SupabaseMerchantShopContextGateway implements MerchantShopContextGateway {
  public async findOwnedShops(
    client: SupabaseClient,
    merchantId: string,
  ): Promise<readonly MerchantCatalogueShopSnapshot[]> {
    try {
      const response = await client
        .from('shops')
        .select(SHOP_SELECT)
        .eq('merchant_id', merchantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new MerchantShopContextGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseMerchantShops(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findOwnedShopById(
    client: SupabaseClient,
    merchantId: string,
    shopId: string,
  ): Promise<MerchantCatalogueShopSnapshot | null> {
    try {
      const response = await client
        .from('shops')
        .select(SHOP_SELECT)
        .eq('id', shopId)
        .eq('merchant_id', merchantId)
        .is('deleted_at', null)
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantShopContextGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableMerchantShop(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
