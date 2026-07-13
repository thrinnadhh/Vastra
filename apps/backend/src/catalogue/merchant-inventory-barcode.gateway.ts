import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import type {
  MerchantInventoryBalanceRecord,
  MerchantInventoryProductRecord,
  MerchantInventoryVariantRecord,
} from './merchant-inventory-balance.types';
import type {
  MerchantInventoryBarcodeLookupRecord,
  MerchantInventoryBarcodeRecord,
  MerchantInventoryBarcodeSource,
  MerchantInventoryBarcodeType,
} from './merchant-inventory-barcode.types';

export interface MerchantInventoryBarcodeGateway {
  findOwnedInventoryByBarcode(
    client: SupabaseClient,
    shopId: string,
    barcode: string,
  ): Promise<MerchantInventoryBarcodeLookupRecord | null>;
}

export class MerchantInventoryBarcodeGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant inventory barcode provider unavailable');
    this.name = 'MerchantInventoryBarcodeGatewayUnavailableError';
  }
}

export class MerchantInventoryBarcodeDataInvalidError extends Error {
  public constructor() {
    super('Merchant inventory barcode data invalid');
    this.name = 'MerchantInventoryBarcodeDataInvalidError';
  }
}

const BARCODE_TYPES = new Set<MerchantInventoryBarcodeType>([
  'EAN13',
  'UPC',
  'CODE128',
  'QR',
  'INTERNAL',
]);

const BARCODE_SOURCES = new Set<MerchantInventoryBarcodeSource>([
  'MANUFACTURER',
  'VASTRA_GENERATED',
  'MERCHANT_ENTERED',
]);

const BARCODE_SELECT = [
  'id',
  'variant_id',
  'barcode_value',
  'barcode_type',
  'source',
  'is_primary',
].join(', ');

const VARIANT_SELECT = [
  'id',
  'product_id',
  'shop_id',
  'sku',
  'colour_name',
  'size_label',
  'is_active',
].join(', ');

const PRODUCT_SELECT = ['id', 'name', 'slug', 'brand', 'is_active'].join(', ');

const BALANCE_SELECT = [
  'stock_on_hand',
  'reserved_quantity',
  'damaged_quantity',
  'reorder_level',
  'version',
  'last_counted_at',
  'updated_at',
].join(', ');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantInventoryBarcodeDataInvalidError();
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
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value === 0) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value;
}

function requireBarcodeType(
  record: Record<string, unknown>,
  key: string,
): MerchantInventoryBarcodeType {
  const value = record[key];

  if (typeof value !== 'string' || !BARCODE_TYPES.has(value as MerchantInventoryBarcodeType)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value as MerchantInventoryBarcodeType;
}

function requireBarcodeSource(
  record: Record<string, unknown>,
  key: string,
): MerchantInventoryBarcodeSource {
  const value = record[key];

  if (typeof value !== 'string' || !BARCODE_SOURCES.has(value as MerchantInventoryBarcodeSource)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return value as MerchantInventoryBarcodeSource;
}

function parseBarcode(value: unknown): MerchantInventoryBarcodeRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    variantId: requireString(value, 'variant_id'),
    value: requireString(value, 'barcode_value'),
    type: requireBarcodeType(value, 'barcode_type'),
    source: requireBarcodeSource(value, 'source'),
    isPrimary: requireBoolean(value, 'is_primary'),
  };
}

function parseNullableBarcode(value: unknown): MerchantInventoryBarcodeRecord | null {
  if (value === null) {
    return null;
  }

  return parseBarcode(value);
}

function parseVariant(value: unknown): MerchantInventoryVariantRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'product_id'),
    shopId: requireString(value, 'shop_id'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colour_name'),
    sizeLabel: requireNullableString(value, 'size_label'),
    isActive: requireBoolean(value, 'is_active'),
  };
}

function parseNullableVariant(value: unknown): MerchantInventoryVariantRecord | null {
  if (value === null) {
    return null;
  }

  return parseVariant(value);
}

function parseProduct(value: unknown): MerchantInventoryProductRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    brand: requireNullableString(value, 'brand'),
    isActive: requireBoolean(value, 'is_active'),
  };
}

function parseNullableProduct(value: unknown): MerchantInventoryProductRecord | null {
  if (value === null) {
    return null;
  }

  return parseProduct(value);
}

function parseBalance(value: unknown): MerchantInventoryBalanceRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBarcodeDataInvalidError();
  }

  return {
    stockOnHand: requireNonNegativeInteger(value, 'stock_on_hand'),
    reservedQuantity: requireNonNegativeInteger(value, 'reserved_quantity'),
    damagedQuantity: requireNonNegativeInteger(value, 'damaged_quantity'),
    reorderLevel: requireNonNegativeInteger(value, 'reorder_level'),
    version: requirePositiveInteger(value, 'version'),
    lastCountedAt: requireNullableString(value, 'last_counted_at'),
    updatedAt: requireString(value, 'updated_at'),
  };
}

function parseNullableBalance(value: unknown): MerchantInventoryBalanceRecord | null {
  if (value === null) {
    return null;
  }

  return parseBalance(value);
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantInventoryBarcodeGatewayUnavailableError ||
    error instanceof MerchantInventoryBarcodeDataInvalidError
  ) {
    throw error;
  }

  throw new MerchantInventoryBarcodeGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantInventoryBarcodeGateway implements MerchantInventoryBarcodeGateway {
  public async findOwnedInventoryByBarcode(
    client: SupabaseClient,
    shopId: string,
    barcodeValue: string,
  ): Promise<MerchantInventoryBarcodeLookupRecord | null> {
    try {
      const barcodeResponse = await client
        .from('variant_barcodes')
        .select(BARCODE_SELECT)
        .eq('barcode_value', barcodeValue)
        .maybeSingle();

      if (barcodeResponse.error !== null) {
        throw new MerchantInventoryBarcodeGatewayUnavailableError();
      }

      const barcodeData: unknown = barcodeResponse.data;
      const barcode = parseNullableBarcode(barcodeData);

      if (barcode === null) {
        return null;
      }

      const variantResponse = await client
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('shop_id', shopId)
        .eq('id', barcode.variantId)
        .maybeSingle();

      if (variantResponse.error !== null) {
        throw new MerchantInventoryBarcodeGatewayUnavailableError();
      }

      const variantData: unknown = variantResponse.data;
      const variant = parseNullableVariant(variantData);

      if (variant === null) {
        throw new MerchantInventoryBarcodeDataInvalidError();
      }

      const productResponse = await client
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('shop_id', shopId)
        .eq('id', variant.productId)
        .is('deleted_at', null)
        .maybeSingle();

      if (productResponse.error !== null) {
        throw new MerchantInventoryBarcodeGatewayUnavailableError();
      }

      const productData: unknown = productResponse.data;
      const product = parseNullableProduct(productData);

      if (product === null) {
        return null;
      }

      const balanceResponse = await client
        .from('inventory_balances')
        .select(BALANCE_SELECT)
        .eq('shop_id', shopId)
        .eq('variant_id', variant.id)
        .maybeSingle();

      if (balanceResponse.error !== null) {
        throw new MerchantInventoryBarcodeGatewayUnavailableError();
      }

      const balanceData: unknown = balanceResponse.data;

      return {
        barcode,
        product,
        variant,
        balance: parseNullableBalance(balanceData),
      };
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
