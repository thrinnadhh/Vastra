import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import type {
  MerchantLowStockItem,
  MerchantLowStockState,
} from './merchant-inventory-low-stock.types';

export interface MerchantInventoryLowStockGateway {
  listOwnedLowStock(
    client: SupabaseClient,
    shopId: string,
    limit: number,
    includeInactive: boolean,
  ): Promise<readonly MerchantLowStockItem[]>;
}

export class MerchantInventoryLowStockGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant low-stock inventory provider unavailable');
    this.name = 'MerchantInventoryLowStockGatewayUnavailableError';
  }
}

export class MerchantInventoryLowStockDataInvalidError extends Error {
  public constructor() {
    super('Merchant low-stock inventory data invalid');
    this.name = 'MerchantInventoryLowStockDataInvalidError';
  }
}

const LOW_STOCK_SELECT = [
  'shop_id',
  'product_id',
  'product_name',
  'product_slug',
  'product_brand',
  'product_is_active',
  'variant_id',
  'sku',
  'colour_name',
  'size_label',
  'variant_is_active',
  'stock_on_hand',
  'reserved_quantity',
  'damaged_quantity',
  'available_quantity',
  'reorder_level',
  'version',
  'last_counted_at',
  'updated_at',
  'inventory_state',
].join(', ');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantInventoryLowStockDataInvalidError();
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
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value === 0) {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value;
}

function requireState(record: Record<string, unknown>): MerchantLowStockState {
  const value = record['inventory_state'];

  if (value !== 'OUT_OF_STOCK' && value !== 'LOW_STOCK') {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value;
}

function parseLowStockItem(value: unknown): MerchantLowStockItem {
  if (!isRecord(value)) {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stock_on_hand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reserved_quantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damaged_quantity');
  const availableQuantity = requireNonNegativeInteger(value, 'available_quantity');
  const reorderLevel = requireNonNegativeInteger(value, 'reorder_level');
  const inventoryState = requireState(value);

  if (
    availableQuantity !== stockOnHand - reservedQuantity - damagedQuantity ||
    availableQuantity > reorderLevel ||
    (availableQuantity === 0 && inventoryState !== 'OUT_OF_STOCK') ||
    (availableQuantity > 0 && inventoryState !== 'LOW_STOCK')
  ) {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  const productId = requireString(value, 'product_id');

  return {
    product: {
      id: productId,
      name: requireString(value, 'product_name'),
      slug: requireString(value, 'product_slug'),
      brand: requireNullableString(value, 'product_brand'),
      isActive: requireBoolean(value, 'product_is_active'),
    },
    variant: {
      id: requireString(value, 'variant_id'),
      productId,
      sku: requireString(value, 'sku'),
      colourName: requireNullableString(value, 'colour_name'),
      sizeLabel: requireNullableString(value, 'size_label'),
      isActive: requireBoolean(value, 'variant_is_active'),
    },
    balance: {
      persisted: true,
      stockOnHand,
      reservedQuantity,
      damagedQuantity,
      availableQuantity,
      reorderLevel,
      version: requirePositiveInteger(value, 'version'),
      lastCountedAt: requireNullableString(value, 'last_counted_at'),
      updatedAt: requireString(value, 'updated_at'),
    },
    inventoryState,
  };
}

function parseRows(value: unknown): readonly MerchantLowStockItem[] {
  if (!Array.isArray(value)) {
    throw new MerchantInventoryLowStockDataInvalidError();
  }

  return value.map((row) => parseLowStockItem(row));
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantInventoryLowStockGatewayUnavailableError ||
    error instanceof MerchantInventoryLowStockDataInvalidError
  ) {
    throw error;
  }

  throw new MerchantInventoryLowStockGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantInventoryLowStockGateway implements MerchantInventoryLowStockGateway {
  public async listOwnedLowStock(
    client: SupabaseClient,
    shopId: string,
    limit: number,
    includeInactive: boolean,
  ): Promise<readonly MerchantLowStockItem[]> {
    try {
      let query = client
        .from('merchant_low_stock_inventory')
        .select(LOW_STOCK_SELECT)
        .eq('shop_id', shopId);

      if (!includeInactive) {
        query = query.eq('product_is_active', true).eq('variant_is_active', true);
      }

      const response = await query
        .order('available_quantity', { ascending: true })
        .order('reorder_level', { ascending: false })
        .order('variant_id', { ascending: true })
        .limit(limit);

      if (response.error !== null) {
        throw new MerchantInventoryLowStockGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseRows(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
