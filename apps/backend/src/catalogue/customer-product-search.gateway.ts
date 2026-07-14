import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerCatalogueImageSnapshot,
  CustomerCatalogueProductCard,
  CustomerCatalogueVariantSnapshot,
} from './customer-catalogue-read.types';
import { PRODUCT_GENDER_CATEGORIES, type ProductGenderCategory } from './merchant-product.types';
import {
  SHOP_OPERATIONAL_STATUSES,
  type ShopOperationalStatus,
} from './merchant-shop-context.types';
import { PRODUCT_IMAGE_TYPES, type ProductImageType } from './product-image.types';
import type {
  CustomerProductSearchCandidate,
  CustomerProductSearchHydratedProduct,
  CustomerProductSearchItem,
  CustomerProductSearchPage,
  CustomerProductSearchQuery,
} from './customer-product-search.types';

const PRODUCT_MEDIA_BUCKET = 'catalogue-media';
const SEARCH_BATCH_SIZE = 50;

export interface CustomerProductSearchGateway {
  searchPublicProducts(
    client: SupabaseClient,
    query: CustomerProductSearchQuery,
  ): Promise<CustomerProductSearchPage>;
}

export class CustomerProductSearchGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer product-search provider unavailable');
    this.name = 'CustomerProductSearchGatewayUnavailableError';
  }
}

export class CustomerProductSearchDataInvalidError extends Error {
  public constructor() {
    super('Customer product-search data invalid');
    this.name = 'CustomerProductSearchDataInvalidError';
  }
}

interface PublicProductRecord {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly genderCategory: ProductGenderCategory;
}

interface PublicVariantRecord {
  readonly id: string;
  readonly productId: string;
  readonly shopId: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly colourHex: string | null;
  readonly sizeLabel: string | null;
  readonly mrpPaise: number;
  readonly sellingPricePaise: number;
  readonly attributes: Readonly<Record<string, unknown>>;
}

interface PublicImageRecord {
  readonly id: string;
  readonly productId: string;
  readonly storageObjectKey: string;
  readonly thumbnailObjectKey: string | null;
  readonly imageType: ProductImageType;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
}

interface InventoryAvailabilityRecord {
  readonly shopId: string;
  readonly variantId: string;
  readonly availableQuantity: number;
}

const PRODUCT_SELECT = [
  'id',
  'shop_id',
  'category_id',
  'name',
  'slug',
  'brand',
  'gender_category',
  'moderation_status',
  'is_active',
  'deleted_at',
].join(', ');

const VARIANT_SELECT = [
  'id',
  'product_id',
  'shop_id',
  'sku',
  'colour_name',
  'colour_hex',
  'size_label',
  'mrp_paise',
  'selling_price_paise',
  'attributes',
  'is_active',
].join(', ');

const IMAGE_SELECT = [
  'id',
  'product_id',
  'variant_id',
  'storage_object_key',
  'thumbnail_object_key',
  'image_type',
  'alt_text',
  'display_order',
  'is_primary',
].join(', ');

const BALANCE_SELECT = [
  'shop_id',
  'variant_id',
  'stock_on_hand',
  'reserved_quantity',
  'damaged_quantity',
].join(', ');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerProductSearchDataInvalidError();
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
    throw new CustomerProductSearchDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireFiniteNumber(record, key);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value;
}

function requireObject(
  record: Record<string, unknown>,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = record[key];

  if (!isRecord(value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value;
}

function requireGenderCategory(record: Record<string, unknown>): ProductGenderCategory {
  const value = record['gender_category'];

  if (
    typeof value !== 'string' ||
    !PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === value)
  ) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value as ProductGenderCategory;
}

function requireOperationalStatus(record: Record<string, unknown>): ShopOperationalStatus {
  const value = record['shop_operational_status'];

  if (
    typeof value !== 'string' ||
    !SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value) ||
    value === 'PAUSED' ||
    value === 'SUSPENDED'
  ) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value as ShopOperationalStatus;
}

function requireImageType(record: Record<string, unknown>): ProductImageType {
  const value = record['image_type'];

  if (typeof value !== 'string' || !PRODUCT_IMAGE_TYPES.some((candidate) => candidate === value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value as ProductImageType;
}

function parseCandidate(value: unknown): CustomerProductSearchCandidate {
  if (!isRecord(value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  const relevanceScore = requireFiniteNumber(value, 'relevance_score');

  if (relevanceScore < 0) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return {
    productId: requireString(value, 'product_id'),
    shop: {
      id: requireString(value, 'shop_id'),
      name: requireString(value, 'shop_name'),
      slug: requireString(value, 'shop_slug'),
      operationalStatus: requireOperationalStatus(value),
      acceptsOnlineOrders: requireBoolean(value, 'shop_accepts_online_orders'),
      distanceMeters: requireNonNegativeInteger(value, 'distance_meters'),
      isServiceable: true,
    },
    relevanceScore,
    sortPricePaise: requireNonNegativeInteger(value, 'sort_price_paise'),
  };
}

function parseProduct(value: unknown): PublicProductRecord {
  if (!isRecord(value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  if (
    value['moderation_status'] !== 'APPROVED' ||
    value['is_active'] !== true ||
    value['deleted_at'] !== null
  ) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    categoryId: requireString(value, 'category_id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    brand: requireNullableString(value, 'brand'),
    genderCategory: requireGenderCategory(value),
  };
}

function parseVariant(value: unknown): PublicVariantRecord {
  if (!isRecord(value) || value['is_active'] !== true) {
    throw new CustomerProductSearchDataInvalidError();
  }

  const mrpPaise = requireNonNegativeInteger(value, 'mrp_paise');
  const sellingPricePaise = requireNonNegativeInteger(value, 'selling_price_paise');

  if (sellingPricePaise > mrpPaise) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'product_id'),
    shopId: requireString(value, 'shop_id'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colour_name'),
    colourHex: requireNullableString(value, 'colour_hex'),
    sizeLabel: requireNullableString(value, 'size_label'),
    mrpPaise,
    sellingPricePaise,
    attributes: requireObject(value, 'attributes'),
  };
}

function parseImage(value: unknown): PublicImageRecord {
  if (!isRecord(value) || value['variant_id'] !== null) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'product_id'),
    storageObjectKey: requireString(value, 'storage_object_key'),
    thumbnailObjectKey: requireNullableString(value, 'thumbnail_object_key'),
    imageType: requireImageType(value),
    altText: requireNullableString(value, 'alt_text'),
    displayOrder: requireNonNegativeInteger(value, 'display_order'),
    isPrimary: requireBoolean(value, 'is_primary'),
  };
}

function parseAvailability(value: unknown): InventoryAvailabilityRecord {
  if (!isRecord(value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stock_on_hand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reserved_quantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damaged_quantity');
  const availableQuantity = stockOnHand - reservedQuantity - damagedQuantity;

  if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return {
    shopId: requireString(value, 'shop_id'),
    variantId: requireString(value, 'variant_id'),
    availableQuantity,
  };
}

function parseRows<T>(value: unknown, parser: (row: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) {
    throw new CustomerProductSearchDataInvalidError();
  }

  return value.map((row) => parser(row));
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerProductSearchGatewayUnavailableError ||
    error instanceof CustomerProductSearchDataInvalidError
  ) {
    throw error;
  }

  throw new CustomerProductSearchGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerProductSearchGateway implements CustomerProductSearchGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async searchPublicProducts(
    client: SupabaseClient,
    query: CustomerProductSearchQuery,
  ): Promise<CustomerProductSearchPage> {
    try {
      const results: CustomerProductSearchItem[] = [];
      let rawOffset = query.offset;
      let exhausted = false;

      while (results.length < query.limit && !exhausted) {
        const batchSize = query.availableOnly
          ? SEARCH_BATCH_SIZE
          : Math.min(SEARCH_BATCH_SIZE, query.limit + 1);
        const candidates = await this.fetchCandidates(client, query, rawOffset, batchSize);

        if (candidates.length === 0) {
          exhausted = true;
          break;
        }

        exhausted = candidates.length < batchSize;
        const hydrated = await this.hydrateCandidates(client, candidates);
        let processed = 0;

        for (const item of hydrated) {
          processed += 1;
          rawOffset += 1;

          if (!query.availableOnly || item.product.isAvailable) {
            results.push(item);
          }

          if (results.length === query.limit) {
            break;
          }
        }

        if (processed < candidates.length) {
          exhausted = false;
        }
      }

      return {
        results,
        nextOffset: results.length === query.limit && !exhausted ? rawOffset : null,
      };
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  private async fetchCandidates(
    client: SupabaseClient,
    query: CustomerProductSearchQuery,
    offset: number,
    limit: number,
  ): Promise<readonly CustomerProductSearchCandidate[]> {
    const response = await client.rpc('search_public_products', {
      p_query: query.term,
      p_latitude: query.latitude,
      p_longitude: query.longitude,
      p_category_id: query.categoryId,
      p_gender: query.genderCategory,
      p_shop_id: query.shopId,
      p_min_price_paise: query.minPricePaise,
      p_max_price_paise: query.maxPricePaise,
      p_sort: query.sort,
      p_offset: offset,
      p_limit: limit,
    });

    if (response.error !== null) {
      throw new CustomerProductSearchGatewayUnavailableError();
    }

    const candidates = parseRows(response.data, parseCandidate);
    const seenProductIds = new Set<string>();

    for (const candidate of candidates) {
      if (seenProductIds.has(candidate.productId)) {
        throw new CustomerProductSearchDataInvalidError();
      }

      seenProductIds.add(candidate.productId);
    }

    return candidates;
  }

  private async hydrateCandidates(
    client: SupabaseClient,
    candidates: readonly CustomerProductSearchCandidate[],
  ): Promise<readonly CustomerProductSearchItem[]> {
    const productIds = candidates.map((candidate) => candidate.productId);
    const productResponse = await client
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', productIds)
      .eq('moderation_status', 'APPROVED')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (productResponse.error !== null) {
      throw new CustomerProductSearchGatewayUnavailableError();
    }

    const products = parseRows(productResponse.data, parseProduct);
    const productById = new Map(products.map((product) => [product.id, product] as const));

    if (productById.size !== candidates.length) {
      throw new CustomerProductSearchDataInvalidError();
    }

    const variantResponse = await client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('product_id', { ascending: true })
      .order('selling_price_paise', { ascending: true })
      .order('id', { ascending: true });

    if (variantResponse.error !== null) {
      throw new CustomerProductSearchGatewayUnavailableError();
    }

    const imageResponse = await client
      .from('product_images')
      .select(IMAGE_SELECT)
      .in('product_id', productIds)
      .is('variant_id', null)
      .order('product_id', { ascending: true })
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })
      .order('id', { ascending: true });

    if (imageResponse.error !== null) {
      throw new CustomerProductSearchGatewayUnavailableError();
    }

    const variants = parseRows(variantResponse.data, parseVariant);
    const images = parseRows(imageResponse.data, parseImage);
    const allowedProductIds = new Set(productIds);

    if (
      variants.some((variant) => !allowedProductIds.has(variant.productId)) ||
      images.some((image) => !allowedProductIds.has(image.productId))
    ) {
      throw new CustomerProductSearchDataInvalidError();
    }

    const availabilityByVariant = await this.fetchAvailability(variants);
    const variantsByProduct = new Map<string, CustomerCatalogueVariantSnapshot[]>();
    const imagesByProduct = new Map<string, CustomerCatalogueImageSnapshot[]>();

    for (const variant of variants) {
      const availableQuantity = availabilityByVariant.get(variant.id) ?? 0;
      const snapshot: CustomerCatalogueVariantSnapshot = {
        id: variant.id,
        sku: variant.sku,
        colourName: variant.colourName,
        colourHex: variant.colourHex,
        sizeLabel: variant.sizeLabel,
        mrpPaise: variant.mrpPaise,
        sellingPricePaise: variant.sellingPricePaise,
        attributes: variant.attributes,
        availableQuantity,
        isAvailable: availableQuantity > 0,
      };
      const existing = variantsByProduct.get(variant.productId) ?? [];
      existing.push(snapshot);
      variantsByProduct.set(variant.productId, existing);
    }

    for (const image of images) {
      const existing = imagesByProduct.get(image.productId) ?? [];
      existing.push(this.toImageSnapshot(image));
      imagesByProduct.set(image.productId, existing);
    }

    const hydratedById = new Map<string, CustomerProductSearchHydratedProduct>();

    for (const product of products) {
      const productVariants = variantsByProduct.get(product.id) ?? [];

      if (productVariants.length === 0) {
        throw new CustomerProductSearchDataInvalidError();
      }

      hydratedById.set(product.id, {
        id: product.id,
        shopId: product.shopId,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        genderCategory: product.genderCategory,
        images: imagesByProduct.get(product.id) ?? [],
        variants: productVariants,
      });
    }

    return candidates.map((candidate) => {
      const hydrated = hydratedById.get(candidate.productId);

      if (hydrated?.shopId !== candidate.shop.id) {
        throw new CustomerProductSearchDataInvalidError();
      }

      return {
        product: this.toProductCard(hydrated),
        shop: candidate.shop,
      };
    });
  }

  private async fetchAvailability(
    variants: readonly PublicVariantRecord[],
  ): Promise<ReadonlyMap<string, number>> {
    if (variants.length === 0) {
      return new Map();
    }

    const variantById = new Map(variants.map((variant) => [variant.id, variant] as const));
    const response = await this.trustedClient
      .from('inventory_balances')
      .select(BALANCE_SELECT)
      .in('variant_id', [...variantById.keys()]);

    if (response.error !== null) {
      throw new CustomerProductSearchGatewayUnavailableError();
    }

    const rows = parseRows(response.data, parseAvailability);
    const result = new Map<string, number>();

    for (const row of rows) {
      const variant = variantById.get(row.variantId);

      if (variant?.shopId !== row.shopId || result.has(row.variantId)) {
        throw new CustomerProductSearchDataInvalidError();
      }

      result.set(row.variantId, row.availableQuantity);
    }

    return result;
  }

  private toProductCard(
    product: CustomerProductSearchHydratedProduct,
  ): CustomerCatalogueProductCard {
    const prices = product.variants.map((variant) => variant.sellingPricePaise);
    const availableVariants = product.variants.filter((variant) => variant.isAvailable);
    const totalAvailableQuantity = availableVariants.reduce(
      (total, variant) => total + variant.availableQuantity,
      0,
    );

    if (!Number.isSafeInteger(totalAvailableQuantity)) {
      throw new CustomerProductSearchDataInvalidError();
    }

    return {
      id: product.id,
      shopId: product.shopId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      genderCategory: product.genderCategory,
      primaryImage: product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null,
      minSellingPricePaise: Math.min(...prices),
      maxSellingPricePaise: Math.max(...prices),
      availableVariantCount: availableVariants.length,
      totalAvailableQuantity,
      isAvailable: availableVariants.length > 0,
    };
  }

  private toImageSnapshot(image: PublicImageRecord): CustomerCatalogueImageSnapshot {
    return {
      id: image.id,
      imageType: image.imageType,
      altText: image.altText,
      displayOrder: image.displayOrder,
      isPrimary: image.isPrimary,
      imageUrl: this.publicUrl(image.storageObjectKey),
      thumbnailUrl:
        image.thumbnailObjectKey === null ? null : this.publicUrl(image.thumbnailObjectKey),
    };
  }

  private publicUrl(objectKey: string): string {
    return this.trustedClient.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(objectKey).data
      .publicUrl;
  }
}
