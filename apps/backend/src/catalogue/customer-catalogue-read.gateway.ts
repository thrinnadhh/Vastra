import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import { PRODUCT_GENDER_CATEGORIES, type ProductGenderCategory } from './merchant-product.types';
import { PRODUCT_IMAGE_TYPES, type ProductImageType } from './product-image.types';
import type {
  CustomerCatalogueImageSnapshot,
  CustomerCatalogueProductCard,
  CustomerCatalogueProductDetail,
  CustomerCatalogueProductPage,
  CustomerCatalogueShopSnapshot,
  CustomerCatalogueVariantSnapshot,
} from './customer-catalogue-read.types';

const PRODUCT_MEDIA_BUCKET = 'catalogue-media';

export interface CustomerCatalogueReadGateway {
  findPublicShop(
    client: SupabaseClient,
    shopId: string,
  ): Promise<CustomerCatalogueShopSnapshot | null>;

  listPublicProducts(
    client: SupabaseClient,
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerCatalogueProductPage>;

  findPublicProduct(
    client: SupabaseClient,
    productId: string,
  ): Promise<CustomerCatalogueProductDetail | null>;
}

export class CustomerCatalogueReadGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer catalogue read provider unavailable');
    this.name = 'CustomerCatalogueReadGatewayUnavailableError';
  }
}

export class CustomerCatalogueReadDataInvalidError extends Error {
  public constructor() {
    super('Customer catalogue read data invalid');
    this.name = 'CustomerCatalogueReadDataInvalidError';
  }
}

interface PublicShopRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
}

interface PublicProductRecord {
  readonly id: string;
  readonly shopId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly brand: string | null;
  readonly material: string | null;
  readonly genderCategory: ProductGenderCategory;
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly careInstructions: string | null;
  readonly returnEligible: boolean;
  readonly returnWindowDays: number;
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
  readonly variantId: string;
  readonly availableQuantity: number;
}

interface HydratedProduct {
  readonly product: PublicProductRecord;
  readonly images: readonly CustomerCatalogueImageSnapshot[];
  readonly variants: readonly CustomerCatalogueVariantSnapshot[];
}

const SHOP_SELECT = [
  'id',
  'name',
  'slug',
  'verification_status',
  'operational_status',
  'accepts_online_orders',
  'deleted_at',
].join(', ');

const PRODUCT_SELECT = [
  'id',
  'shop_id',
  'category_id',
  'name',
  'slug',
  'description',
  'brand',
  'material',
  'gender_category',
  'style_tags',
  'occasion_tags',
  'care_instructions',
  'return_eligible',
  'return_window_days',
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
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerCatalogueReadDataInvalidError();
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
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value as readonly string[];
}

function requireObject(
  record: Record<string, unknown>,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = record[key];

  if (!isRecord(value)) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value;
}

function requireGenderCategory(record: Record<string, unknown>): ProductGenderCategory {
  const value = record['gender_category'];

  if (
    typeof value !== 'string' ||
    !PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === value)
  ) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value as ProductGenderCategory;
}

function requireImageType(record: Record<string, unknown>): ProductImageType {
  const value = record['image_type'];

  if (typeof value !== 'string' || !PRODUCT_IMAGE_TYPES.some((candidate) => candidate === value)) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value as ProductImageType;
}

function parseShop(value: unknown): PublicShopRecord {
  if (!isRecord(value)) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  const verificationStatus = value['verification_status'];
  const operationalStatus = requireString(value, 'operational_status');

  if (
    verificationStatus !== 'VERIFIED' ||
    operationalStatus === 'PAUSED' ||
    operationalStatus === 'SUSPENDED' ||
    value['deleted_at'] !== null
  ) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    operationalStatus,
    acceptsOnlineOrders: requireBoolean(value, 'accepts_online_orders'),
  };
}

function parseProduct(value: unknown): PublicProductRecord {
  if (!isRecord(value)) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  if (
    value['moderation_status'] !== 'APPROVED' ||
    value['is_active'] !== true ||
    value['deleted_at'] !== null
  ) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    categoryId: requireString(value, 'category_id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    description: requireNullableString(value, 'description'),
    brand: requireNullableString(value, 'brand'),
    material: requireNullableString(value, 'material'),
    genderCategory: requireGenderCategory(value),
    styleTags: requireStringArray(value, 'style_tags'),
    occasionTags: requireStringArray(value, 'occasion_tags'),
    careInstructions: requireNullableString(value, 'care_instructions'),
    returnEligible: requireBoolean(value, 'return_eligible'),
    returnWindowDays: requireNonNegativeInteger(value, 'return_window_days'),
  };
}

function parseVariant(value: unknown): PublicVariantRecord {
  if (!isRecord(value) || value['is_active'] !== true) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  const mrpPaise = requireNonNegativeInteger(value, 'mrp_paise');
  const sellingPricePaise = requireNonNegativeInteger(value, 'selling_price_paise');

  if (sellingPricePaise > mrpPaise) {
    throw new CustomerCatalogueReadDataInvalidError();
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
    throw new CustomerCatalogueReadDataInvalidError();
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
    throw new CustomerCatalogueReadDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stock_on_hand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reserved_quantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damaged_quantity');
  const availableQuantity = stockOnHand - reservedQuantity - damagedQuantity;

  if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return {
    variantId: requireString(value, 'variant_id'),
    availableQuantity,
  };
}

function parseRows<T>(value: unknown, parser: (row: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  return value.map((row) => parser(row));
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerCatalogueReadGatewayUnavailableError ||
    error instanceof CustomerCatalogueReadDataInvalidError
  ) {
    throw error;
  }

  throw new CustomerCatalogueReadGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerCatalogueReadGateway implements CustomerCatalogueReadGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findPublicShop(
    client: SupabaseClient,
    shopId: string,
  ): Promise<CustomerCatalogueShopSnapshot | null> {
    try {
      const response = await client
        .from('shops')
        .select(SHOP_SELECT)
        .eq('id', shopId)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerCatalogueReadGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return data === null ? null : this.toShopSnapshot(parseShop(data));
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async listPublicProducts(
    client: SupabaseClient,
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerCatalogueProductPage> {
    try {
      let query = client
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('shop_id', shopId)
        .eq('moderation_status', 'APPROVED')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(limit + 1);

      if (cursor !== null) {
        query = query.gt('id', cursor);
      }

      const response = await query;

      if (response.error !== null) {
        throw new CustomerCatalogueReadGatewayUnavailableError();
      }

      const rows = parseRows(response.data, parseProduct);

      if (rows.some((row) => row.shopId !== shopId)) {
        throw new CustomerCatalogueReadDataInvalidError();
      }

      const hasMore = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const hydrated = await this.hydrateProducts(client, shopId, pageRows);
      const products = hydrated.map((item) => this.toProductCard(item));
      const lastProduct = products.at(-1);

      return {
        products,
        nextCursor: hasMore && lastProduct !== undefined ? lastProduct.id : null,
      };
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findPublicProduct(
    client: SupabaseClient,
    productId: string,
  ): Promise<CustomerCatalogueProductDetail | null> {
    try {
      const response = await client
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', productId)
        .eq('moderation_status', 'APPROVED')
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerCatalogueReadGatewayUnavailableError();
      }

      const data: unknown = response.data;

      if (data === null) {
        return null;
      }

      const product = parseProduct(data);
      const shop = await this.findPublicShop(client, product.shopId);

      if (shop === null) {
        return null;
      }

      const hydrated = await this.hydrateProducts(client, product.shopId, [product]);
      const item = hydrated[0];

      if (item === undefined) {
        throw new CustomerCatalogueReadDataInvalidError();
      }

      return {
        ...this.toProductCard(item),
        shop,
        description: product.description,
        material: product.material,
        styleTags: product.styleTags,
        occasionTags: product.occasionTags,
        careInstructions: product.careInstructions,
        returnEligible: product.returnEligible,
        returnWindowDays: product.returnWindowDays,
        images: item.images,
        variants: item.variants,
      };
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  private async hydrateProducts(
    client: SupabaseClient,
    shopId: string,
    products: readonly PublicProductRecord[],
  ): Promise<readonly HydratedProduct[]> {
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((product) => product.id);
    const variantResponse = await client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .eq('shop_id', shopId)
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('product_id', { ascending: true })
      .order('selling_price_paise', { ascending: true })
      .order('id', { ascending: true });

    if (variantResponse.error !== null) {
      throw new CustomerCatalogueReadGatewayUnavailableError();
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
      throw new CustomerCatalogueReadGatewayUnavailableError();
    }

    const variants = parseRows(variantResponse.data, parseVariant);
    const images = parseRows(imageResponse.data, parseImage);
    const productIdSet = new Set(productIds);

    if (
      variants.some(
        (variant) => variant.shopId !== shopId || !productIdSet.has(variant.productId),
      ) ||
      images.some((image) => !productIdSet.has(image.productId))
    ) {
      throw new CustomerCatalogueReadDataInvalidError();
    }

    const availabilityByVariant = await this.fetchAvailability(
      shopId,
      variants.map((variant) => variant.id),
    );
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
      const snapshot = this.toImageSnapshot(image);
      const existing = imagesByProduct.get(image.productId) ?? [];
      existing.push(snapshot);
      imagesByProduct.set(image.productId, existing);
    }

    return products.map((product) => ({
      product,
      images: imagesByProduct.get(product.id) ?? [],
      variants: variantsByProduct.get(product.id) ?? [],
    }));
  }

  private async fetchAvailability(
    shopId: string,
    variantIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    const response = await this.trustedClient
      .from('inventory_balances')
      .select(BALANCE_SELECT)
      .eq('shop_id', shopId)
      .in('variant_id', [...variantIds]);

    if (response.error !== null) {
      throw new CustomerCatalogueReadGatewayUnavailableError();
    }

    const rows = parseRows(response.data, parseAvailability);
    const result = new Map<string, number>();
    const allowedVariantIds = new Set(variantIds);

    for (const row of rows) {
      if (!allowedVariantIds.has(row.variantId) || result.has(row.variantId)) {
        throw new CustomerCatalogueReadDataInvalidError();
      }

      result.set(row.variantId, row.availableQuantity);
    }

    return result;
  }

  private toProductCard(item: HydratedProduct): CustomerCatalogueProductCard {
    const prices = item.variants.map((variant) => variant.sellingPricePaise);
    const availableVariants = item.variants.filter((variant) => variant.isAvailable);
    const totalAvailableQuantity = availableVariants.reduce(
      (total, variant) => total + variant.availableQuantity,
      0,
    );

    if (!Number.isSafeInteger(totalAvailableQuantity)) {
      throw new CustomerCatalogueReadDataInvalidError();
    }

    return {
      id: item.product.id,
      shopId: item.product.shopId,
      categoryId: item.product.categoryId,
      name: item.product.name,
      slug: item.product.slug,
      brand: item.product.brand,
      genderCategory: item.product.genderCategory,
      primaryImage: item.images.find((image) => image.isPrimary) ?? item.images[0] ?? null,
      minSellingPricePaise: prices.length === 0 ? null : Math.min(...prices),
      maxSellingPricePaise: prices.length === 0 ? null : Math.max(...prices),
      availableVariantCount: availableVariants.length,
      totalAvailableQuantity,
      isAvailable: availableVariants.length > 0,
    };
  }

  private toShopSnapshot(shop: PublicShopRecord): CustomerCatalogueShopSnapshot {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      operationalStatus: shop.operationalStatus,
      acceptsOnlineOrders: shop.acceptsOnlineOrders,
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
