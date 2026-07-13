import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateMerchantProductVariantInput,
  MerchantProductVariantSnapshot,
  UpdateMerchantProductVariantInput,
} from './merchant-product-variant.types';

export interface MerchantProductVariantGateway {
  findOwnedVariants(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<readonly MerchantProductVariantSnapshot[]>;

  findOwnedVariantById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null>;

  createVariant(
    shopId: string,
    productId: string,
    input: CreateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot>;

  updateVariant(
    shopId: string,
    productId: string,
    variantId: string,
    input: UpdateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot | null>;

  deactivateVariant(
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null>;
}

export class MerchantProductVariantGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant product variant provider unavailable');
    this.name = 'MerchantProductVariantGatewayUnavailableError';
  }
}

export class MerchantProductVariantDataInvalidError extends Error {
  public constructor() {
    super('Merchant product variant data invalid');
    this.name = 'MerchantProductVariantDataInvalidError';
  }
}

export class MerchantProductVariantSkuConflictError extends Error {
  public constructor() {
    super('Merchant product variant SKU conflicts with an existing variant');
    this.name = 'MerchantProductVariantSkuConflictError';
  }
}

export class MerchantProductVariantConstraintError extends Error {
  public constructor() {
    super('Merchant product variant violates a database constraint');
    this.name = 'MerchantProductVariantConstraintError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantProductVariantDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantProductVariantDataInvalidError();
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
    throw new MerchantProductVariantDataInvalidError();
  }

  return value;
}

function requireNullableSafeNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  return requireSafeNonNegativeInteger(record, key);
}

function requireNullablePositiveInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  const value = requireSafeNonNegativeInteger(record, key);

  if (value === 0) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return value;
}

function requireNullablePositiveNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  const value = parseNumericValue(record[key]);

  if (!Number.isFinite(value) || value <= 0) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return value;
}

function requireAttributes(
  record: Record<string, unknown>,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = record[key];

  if (!isRecord(value)) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return { ...value };
}

function parseVariant(value: unknown): MerchantProductVariantSnapshot {
  if (!isRecord(value)) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'product_id'),
    shopId: requireString(value, 'shop_id'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colour_name'),
    colourHex: requireNullableString(value, 'colour_hex'),
    sizeLabel: requireNullableString(value, 'size_label'),
    mrpPaise: requireSafeNonNegativeInteger(value, 'mrp_paise'),
    sellingPricePaise: requireSafeNonNegativeInteger(value, 'selling_price_paise'),
    costPricePaise: requireNullableSafeNonNegativeInteger(value, 'cost_price_paise'),
    weightGrams: requireNullablePositiveInteger(value, 'weight_grams'),
    lengthCm: requireNullablePositiveNumber(value, 'length_cm'),
    widthCm: requireNullablePositiveNumber(value, 'width_cm'),
    heightCm: requireNullablePositiveNumber(value, 'height_cm'),
    attributes: requireAttributes(value, 'attributes'),
    isActive: requireBoolean(value, 'is_active'),
    createdAt: requireString(value, 'created_at'),
    updatedAt: requireString(value, 'updated_at'),
  };
}

function parseVariants(value: unknown): readonly MerchantProductVariantSnapshot[] {
  if (!Array.isArray(value)) {
    throw new MerchantProductVariantDataInvalidError();
  }

  return value.map((variant) => parseVariant(variant));
}

function parseNullableVariant(value: unknown): MerchantProductVariantSnapshot | null {
  if (value === null) {
    return null;
  }

  return parseVariant(value);
}

function readPostgresCode(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = value['code'];
  return typeof code === 'string' ? code : null;
}

function isUniqueViolation(value: unknown): boolean {
  return readPostgresCode(value) === '23505';
}

function isConstraintViolation(value: unknown): boolean {
  const code = readPostgresCode(value);
  return code === '23514' || code === '22003' || code === '22P02';
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantProductVariantGatewayUnavailableError ||
    error instanceof MerchantProductVariantDataInvalidError ||
    error instanceof MerchantProductVariantSkuConflictError ||
    error instanceof MerchantProductVariantConstraintError
  ) {
    throw error;
  }

  throw new MerchantProductVariantGatewayUnavailableError();
}

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
  'cost_price_paise',
  'weight_grams',
  'length_cm',
  'width_cm',
  'height_cm',
  'attributes',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

function createInsertPayload(
  shopId: string,
  productId: string,
  input: CreateMerchantProductVariantInput,
): Record<string, unknown> {
  return {
    shop_id: shopId,
    product_id: productId,
    sku: input.sku,
    colour_name: input.colourName,
    colour_hex: input.colourHex,
    size_label: input.sizeLabel,
    mrp_paise: input.mrpPaise,
    selling_price_paise: input.sellingPricePaise,
    cost_price_paise: input.costPricePaise,
    weight_grams: input.weightGrams,
    length_cm: input.lengthCm,
    width_cm: input.widthCm,
    height_cm: input.heightCm,
    attributes: input.attributes,
    is_active: input.isActive,
  };
}

function createUpdatePayload(input: UpdateMerchantProductVariantInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.sku !== undefined) {
    payload['sku'] = input.sku;
  }

  if (input.colourName !== undefined) {
    payload['colour_name'] = input.colourName;
  }

  if (input.colourHex !== undefined) {
    payload['colour_hex'] = input.colourHex;
  }

  if (input.sizeLabel !== undefined) {
    payload['size_label'] = input.sizeLabel;
  }

  if (input.mrpPaise !== undefined) {
    payload['mrp_paise'] = input.mrpPaise;
  }

  if (input.sellingPricePaise !== undefined) {
    payload['selling_price_paise'] = input.sellingPricePaise;
  }

  if (input.costPricePaise !== undefined) {
    payload['cost_price_paise'] = input.costPricePaise;
  }

  if (input.weightGrams !== undefined) {
    payload['weight_grams'] = input.weightGrams;
  }

  if (input.lengthCm !== undefined) {
    payload['length_cm'] = input.lengthCm;
  }

  if (input.widthCm !== undefined) {
    payload['width_cm'] = input.widthCm;
  }

  if (input.heightCm !== undefined) {
    payload['height_cm'] = input.heightCm;
  }

  if (input.attributes !== undefined) {
    payload['attributes'] = input.attributes;
  }

  if (input.isActive !== undefined) {
    payload['is_active'] = input.isActive;
  }

  return payload;
}

function throwForWriteError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new MerchantProductVariantSkuConflictError();
  }

  if (isConstraintViolation(error)) {
    throw new MerchantProductVariantConstraintError();
  }

  throw new MerchantProductVariantGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantProductVariantGateway implements MerchantProductVariantGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findOwnedVariants(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<readonly MerchantProductVariantSnapshot[]> {
    try {
      const response = await client
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('shop_id', shopId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new MerchantProductVariantGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseVariants(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findOwnedVariantById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null> {
    try {
      const response = await client
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('shop_id', shopId)
        .eq('product_id', productId)
        .eq('id', variantId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantProductVariantGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createVariant(
    shopId: string,
    productId: string,
    input: CreateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot> {
    try {
      const response = await this.trustedClient
        .from('product_variants')
        .insert(createInsertPayload(shopId, productId, input))
        .select(VARIANT_SELECT)
        .single();

      if (response.error !== null) {
        return throwForWriteError(response.error);
      }

      const data: unknown = response.data;
      return parseVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async updateVariant(
    shopId: string,
    productId: string,
    variantId: string,
    input: UpdateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot | null> {
    try {
      const response = await this.trustedClient
        .from('product_variants')
        .update(createUpdatePayload(input))
        .eq('shop_id', shopId)
        .eq('product_id', productId)
        .eq('id', variantId)
        .select(VARIANT_SELECT)
        .maybeSingle();

      if (response.error !== null) {
        return throwForWriteError(response.error);
      }

      const data: unknown = response.data;
      return parseNullableVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async deactivateVariant(
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null> {
    try {
      const response = await this.trustedClient
        .from('product_variants')
        .update({ is_active: false })
        .eq('shop_id', shopId)
        .eq('product_id', productId)
        .eq('id', variantId)
        .select(VARIANT_SELECT)
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantProductVariantGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
