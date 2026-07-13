import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import type {
  MerchantInventoryBalanceRecord,
  MerchantInventoryMatchKind,
  MerchantInventoryProductRecord,
  MerchantInventoryRecord,
  MerchantInventoryVariantRecord,
} from './merchant-inventory-balance.types';

export interface MerchantInventoryBalanceGateway {
  findOwnedInventoryByVariantId(
    client: SupabaseClient,
    shopId: string,
    variantId: string,
  ): Promise<MerchantInventoryRecord | null>;

  lookupOwnedInventory(
    client: SupabaseClient,
    shopId: string,
    query: string,
    limit: number,
  ): Promise<readonly MerchantInventoryRecord[]>;
}

export class MerchantInventoryBalanceGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant inventory balance provider unavailable');
    this.name = 'MerchantInventoryBalanceGatewayUnavailableError';
  }
}

export class MerchantInventoryBalanceDataInvalidError extends Error {
  public constructor() {
    super('Merchant inventory balance data invalid');
    this.name = 'MerchantInventoryBalanceDataInvalidError';
  }
}

interface RankedVariant {
  readonly variant: MerchantInventoryVariantRecord;
  readonly matchKind: MerchantInventoryMatchKind;
  readonly rank: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
  'variant_id',
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
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value;
}

function parseNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function requireSafeNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumericValue(record[key]);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value;
}

function requireSafePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireSafeNonNegativeInteger(record, key);

  if (value === 0) {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value;
}

function parseVariant(value: unknown): MerchantInventoryVariantRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBalanceDataInvalidError();
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

function parseProduct(value: unknown): MerchantInventoryProductRecord {
  if (!isRecord(value)) {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    brand: requireNullableString(value, 'brand'),
    isActive: requireBoolean(value, 'is_active'),
  };
}

interface ParsedBalance {
  readonly variantId: string;
  readonly balance: MerchantInventoryBalanceRecord;
}

function parseBalance(value: unknown): ParsedBalance {
  if (!isRecord(value)) {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return {
    variantId: requireString(value, 'variant_id'),
    balance: {
      stockOnHand: requireSafeNonNegativeInteger(value, 'stock_on_hand'),
      reservedQuantity: requireSafeNonNegativeInteger(value, 'reserved_quantity'),
      damagedQuantity: requireSafeNonNegativeInteger(value, 'damaged_quantity'),
      reorderLevel: requireSafeNonNegativeInteger(value, 'reorder_level'),
      version: requireSafePositiveInteger(value, 'version'),
      lastCountedAt: requireNullableString(value, 'last_counted_at'),
      updatedAt: requireString(value, 'updated_at'),
    },
  };
}

function parseRows<T>(value: unknown, parser: (row: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) {
    throw new MerchantInventoryBalanceDataInvalidError();
  }

  return value.map((row) => parser(row));
}

function parseNullableVariant(value: unknown): MerchantInventoryVariantRecord | null {
  if (value === null) {
    return null;
  }

  return parseVariant(value);
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantInventoryBalanceGatewayUnavailableError ||
    error instanceof MerchantInventoryBalanceDataInvalidError
  ) {
    throw error;
  }

  throw new MerchantInventoryBalanceGatewayUnavailableError();
}

function addCandidate(candidates: Map<string, RankedVariant>, candidate: RankedVariant): void {
  const existing = candidates.get(candidate.variant.id);

  if (
    existing === undefined ||
    candidate.rank < existing.rank ||
    (candidate.rank === existing.rank && candidate.matchKind.localeCompare(existing.matchKind) < 0)
  ) {
    candidates.set(candidate.variant.id, candidate);
  }
}

function rankSku(
  variant: MerchantInventoryVariantRecord,
  normalizedQuery: string,
): Pick<RankedVariant, 'matchKind' | 'rank'> {
  if (variant.sku.toLocaleLowerCase('en-US') === normalizedQuery) {
    return {
      matchKind: 'SKU_EXACT',
      rank: 2,
    };
  }

  return {
    matchKind: 'SKU_PARTIAL',
    rank: 3,
  };
}

@Injectable()
export class SupabaseMerchantInventoryBalanceGateway implements MerchantInventoryBalanceGateway {
  public async findOwnedInventoryByVariantId(
    client: SupabaseClient,
    shopId: string,
    variantId: string,
  ): Promise<MerchantInventoryRecord | null> {
    try {
      const variant = await this.fetchVariantById(client, shopId, variantId);

      if (variant === null) {
        return null;
      }

      const hydrated = await this.hydrate(client, shopId, [
        {
          variant,
          matchKind: 'VARIANT_ID',
          rank: 0,
        },
      ]);

      const record = hydrated[0];

      if (record === undefined) {
        throw new MerchantInventoryBalanceDataInvalidError();
      }

      return record;
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async lookupOwnedInventory(
    client: SupabaseClient,
    shopId: string,
    query: string,
    limit: number,
  ): Promise<readonly MerchantInventoryRecord[]> {
    try {
      const candidateLimit = Math.min(200, Math.max(limit * 4, 40));
      const normalizedQuery = query.toLocaleLowerCase('en-US');
      const candidates = new Map<string, RankedVariant>();
      const productMatches = new Map<
        string,
        {
          readonly kind: MerchantInventoryMatchKind;
          readonly rank: number;
        }
      >();

      if (UUID_PATTERN.test(query)) {
        const exactVariant = await this.fetchVariantById(client, shopId, query);

        if (exactVariant !== null) {
          addCandidate(candidates, {
            variant: exactVariant,
            matchKind: 'VARIANT_ID',
            rank: 0,
          });
        }

        const exactProduct = await this.fetchProductById(client, shopId, query);

        if (exactProduct !== null) {
          productMatches.set(exactProduct.id, {
            kind: 'PRODUCT_ID',
            rank: 1,
          });
        }
      }

      const skuMatches = await this.fetchVariantsBySku(client, shopId, query, candidateLimit);

      for (const variant of skuMatches) {
        const ranking = rankSku(variant, normalizedQuery);
        addCandidate(candidates, {
          variant,
          ...ranking,
        });
      }

      const products = await this.searchProducts(client, shopId, query, candidateLimit);

      for (const product of products) {
        if (!productMatches.has(product.id)) {
          productMatches.set(product.id, {
            kind: 'PRODUCT',
            rank: 4,
          });
        }
      }

      const productIds = [...productMatches.keys()];
      const productVariants = await this.fetchVariantsByProductIds(
        client,
        shopId,
        productIds,
        candidateLimit,
      );

      for (const variant of productVariants) {
        const productMatch = productMatches.get(variant.productId);

        if (productMatch === undefined) {
          throw new MerchantInventoryBalanceDataInvalidError();
        }

        addCandidate(candidates, {
          variant,
          matchKind: productMatch.kind,
          rank: productMatch.rank,
        });
      }

      const ranked = [...candidates.values()]
        .sort((left, right) => {
          if (left.rank !== right.rank) {
            return left.rank - right.rank;
          }

          const skuOrder = left.variant.sku.localeCompare(right.variant.sku, 'en', {
            sensitivity: 'base',
          });

          if (skuOrder !== 0) {
            return skuOrder;
          }

          return left.variant.id.localeCompare(right.variant.id);
        })
        .slice(0, limit);

      return await this.hydrate(client, shopId, ranked);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  private async fetchVariantById(
    client: SupabaseClient,
    shopId: string,
    variantId: string,
  ): Promise<MerchantInventoryVariantRecord | null> {
    const response = await client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .eq('shop_id', shopId)
      .eq('id', variantId)
      .maybeSingle();

    if (response.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const data: unknown = response.data;
    return parseNullableVariant(data);
  }

  private async fetchVariantsBySku(
    client: SupabaseClient,
    shopId: string,
    query: string,
    limit: number,
  ): Promise<readonly MerchantInventoryVariantRecord[]> {
    const pattern = `%${escapeLikePattern(query)}%`;
    const response = await client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .eq('shop_id', shopId)
      .ilike('sku', pattern)
      .order('sku', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);

    if (response.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const data: unknown = response.data;
    return parseRows(data, parseVariant);
  }

  private async fetchProductById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<MerchantInventoryProductRecord | null> {
    const response = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('shop_id', shopId)
      .eq('id', productId)
      .is('deleted_at', null)
      .maybeSingle();

    if (response.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const data: unknown = response.data;

    if (data === null) {
      return null;
    }

    return parseProduct(data);
  }

  private async searchProducts(
    client: SupabaseClient,
    shopId: string,
    query: string,
    limit: number,
  ): Promise<readonly MerchantInventoryProductRecord[]> {
    const response = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .textSearch('search_vector', query, {
        config: 'simple',
        type: 'websearch',
      })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);

    if (response.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const data: unknown = response.data;
    return parseRows(data, parseProduct);
  }

  private async fetchVariantsByProductIds(
    client: SupabaseClient,
    shopId: string,
    productIds: readonly string[],
    limit: number,
  ): Promise<readonly MerchantInventoryVariantRecord[]> {
    if (productIds.length === 0) {
      return [];
    }

    const response = await client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .eq('shop_id', shopId)
      .in('product_id', [...productIds])
      .order('sku', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);

    if (response.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const data: unknown = response.data;
    return parseRows(data, parseVariant);
  }

  private async hydrate(
    client: SupabaseClient,
    shopId: string,
    candidates: readonly RankedVariant[],
  ): Promise<readonly MerchantInventoryRecord[]> {
    if (candidates.length === 0) {
      return [];
    }

    const productIds = [...new Set(candidates.map((candidate) => candidate.variant.productId))];
    const variantIds = candidates.map((candidate) => candidate.variant.id);

    const productResponse = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('shop_id', shopId)
      .in('id', productIds);

    if (productResponse.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const productData: unknown = productResponse.data;
    const products = parseRows(productData, parseProduct);
    const productsById = new Map(products.map((product) => [product.id, product] as const));

    const balanceResponse = await client
      .from('inventory_balances')
      .select(BALANCE_SELECT)
      .eq('shop_id', shopId)
      .in('variant_id', variantIds);

    if (balanceResponse.error !== null) {
      throw new MerchantInventoryBalanceGatewayUnavailableError();
    }

    const balanceData: unknown = balanceResponse.data;
    const parsedBalances = parseRows(balanceData, parseBalance);
    const balancesByVariantId = new Map<string, MerchantInventoryBalanceRecord>();

    for (const parsed of parsedBalances) {
      if (balancesByVariantId.has(parsed.variantId)) {
        throw new MerchantInventoryBalanceDataInvalidError();
      }

      balancesByVariantId.set(parsed.variantId, parsed.balance);
    }

    return candidates.map((candidate) => {
      const product = productsById.get(candidate.variant.productId);

      if (product === undefined) {
        throw new MerchantInventoryBalanceDataInvalidError();
      }

      return {
        product,
        variant: candidate.variant,
        balance: balancesByVariantId.get(candidate.variant.id) ?? null,
        matchKind: candidate.matchKind,
      };
    });
  }
}
