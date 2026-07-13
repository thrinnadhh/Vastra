import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  PRODUCT_GENDER_CATEGORIES,
  PRODUCT_MODERATION_STATUSES,
  type CreateMerchantProductInput,
  type MerchantProductSnapshot,
  type ProductGenderCategory,
  type ProductModerationStatus,
  type UpdateMerchantProductInput,
} from './merchant-product.types';

export interface MerchantProductGateway {
  findOwnedProducts(
    client: SupabaseClient,
    shopId: string,
  ): Promise<readonly MerchantProductSnapshot[]>;

  findOwnedProductById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<MerchantProductSnapshot | null>;

  createProduct(
    shopId: string,
    input: CreateMerchantProductInput,
  ): Promise<MerchantProductSnapshot>;

  updateProduct(
    shopId: string,
    productId: string,
    input: UpdateMerchantProductInput,
    resetModeration: boolean,
  ): Promise<MerchantProductSnapshot | null>;

  archiveProduct(shopId: string, productId: string, deletedAt: string): Promise<boolean>;
}

export class MerchantProductGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant product provider unavailable');
    this.name = 'MerchantProductGatewayUnavailableError';
  }
}

export class MerchantProductDataInvalidError extends Error {
  public constructor() {
    super('Merchant product data invalid');
    this.name = 'MerchantProductDataInvalidError';
  }
}

export class MerchantProductSlugConflictError extends Error {
  public constructor() {
    super('Merchant product slug conflicts with an existing product');
    this.name = 'MerchantProductSlugConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantProductDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantProductDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantProductDataInvalidError();
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
    throw new MerchantProductDataInvalidError();
  }

  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new MerchantProductDataInvalidError();
  }

  return value;
}

function isGenderCategory(value: unknown): value is ProductGenderCategory {
  return (
    typeof value === 'string' && PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === value)
  );
}

function isModerationStatus(value: unknown): value is ProductModerationStatus {
  return (
    typeof value === 'string' &&
    PRODUCT_MODERATION_STATUSES.some((candidate) => candidate === value)
  );
}

function parseProduct(value: unknown): MerchantProductSnapshot {
  if (!isRecord(value)) {
    throw new MerchantProductDataInvalidError();
  }

  const genderCategory = value['gender_category'];
  const moderationStatus = value['moderation_status'];

  if (!isGenderCategory(genderCategory) || !isModerationStatus(moderationStatus)) {
    throw new MerchantProductDataInvalidError();
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
    genderCategory,
    styleTags: requireStringArray(value, 'style_tags'),
    occasionTags: requireStringArray(value, 'occasion_tags'),
    careInstructions: requireNullableString(value, 'care_instructions'),
    returnEligible: requireBoolean(value, 'return_eligible'),
    returnWindowDays: requireSafeNonNegativeInteger(value, 'return_window_days'),
    moderationStatus,
    isActive: requireBoolean(value, 'is_active'),
    createdAt: requireString(value, 'created_at'),
    updatedAt: requireString(value, 'updated_at'),
    deletedAt: requireNullableString(value, 'deleted_at'),
  };
}

function parseProducts(value: unknown): readonly MerchantProductSnapshot[] {
  if (!Array.isArray(value)) {
    throw new MerchantProductDataInvalidError();
  }

  return value.map((product) => parseProduct(product));
}

function parseNullableProduct(value: unknown): MerchantProductSnapshot | null {
  if (value === null) {
    return null;
  }

  return parseProduct(value);
}

function isUniqueViolation(value: unknown): boolean {
  return isRecord(value) && value['code'] === '23505';
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantProductGatewayUnavailableError ||
    error instanceof MerchantProductDataInvalidError ||
    error instanceof MerchantProductSlugConflictError
  ) {
    throw error;
  }

  throw new MerchantProductGatewayUnavailableError();
}

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
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

function createInsertPayload(
  shopId: string,
  input: CreateMerchantProductInput,
): Record<string, unknown> {
  return {
    shop_id: shopId,
    category_id: input.categoryId,
    name: input.name,
    slug: input.slug,
    description: input.description,
    brand: input.brand,
    material: input.material,
    gender_category: input.genderCategory,
    style_tags: input.styleTags,
    occasion_tags: input.occasionTags,
    care_instructions: input.careInstructions,
    return_eligible: input.returnEligible,
    return_window_days: input.returnWindowDays,
    moderation_status: 'PENDING',
    is_active: input.isActive,
  };
}

function createUpdatePayload(
  input: UpdateMerchantProductInput,
  resetModeration: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.categoryId !== undefined) {
    payload['category_id'] = input.categoryId;
  }

  if (input.name !== undefined) {
    payload['name'] = input.name;
  }

  if (input.slug !== undefined) {
    payload['slug'] = input.slug;
  }

  if (input.description !== undefined) {
    payload['description'] = input.description;
  }

  if (input.brand !== undefined) {
    payload['brand'] = input.brand;
  }

  if (input.material !== undefined) {
    payload['material'] = input.material;
  }

  if (input.genderCategory !== undefined) {
    payload['gender_category'] = input.genderCategory;
  }

  if (input.styleTags !== undefined) {
    payload['style_tags'] = input.styleTags;
  }

  if (input.occasionTags !== undefined) {
    payload['occasion_tags'] = input.occasionTags;
  }

  if (input.careInstructions !== undefined) {
    payload['care_instructions'] = input.careInstructions;
  }

  if (input.returnEligible !== undefined) {
    payload['return_eligible'] = input.returnEligible;
  }

  if (input.returnWindowDays !== undefined) {
    payload['return_window_days'] = input.returnWindowDays;
  }

  if (input.isActive !== undefined) {
    payload['is_active'] = input.isActive;
  }

  if (resetModeration) {
    payload['moderation_status'] = 'PENDING';
  }

  return payload;
}

@Injectable()
export class SupabaseMerchantProductGateway implements MerchantProductGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findOwnedProducts(
    client: SupabaseClient,
    shopId: string,
  ): Promise<readonly MerchantProductSnapshot[]> {
    try {
      const response = await client
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new MerchantProductGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseProducts(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findOwnedProductById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<MerchantProductSnapshot | null> {
    try {
      const response = await client
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('shop_id', shopId)
        .eq('id', productId)
        .is('deleted_at', null)
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantProductGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableProduct(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createProduct(
    shopId: string,
    input: CreateMerchantProductInput,
  ): Promise<MerchantProductSnapshot> {
    try {
      const response = await this.trustedClient
        .from('products')
        .insert(createInsertPayload(shopId, input))
        .select(PRODUCT_SELECT)
        .single();

      if (response.error !== null) {
        if (isUniqueViolation(response.error)) {
          throw new MerchantProductSlugConflictError();
        }

        throw new MerchantProductGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseProduct(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async updateProduct(
    shopId: string,
    productId: string,
    input: UpdateMerchantProductInput,
    resetModeration: boolean,
  ): Promise<MerchantProductSnapshot | null> {
    try {
      const response = await this.trustedClient
        .from('products')
        .update(createUpdatePayload(input, resetModeration))
        .eq('shop_id', shopId)
        .eq('id', productId)
        .is('deleted_at', null)
        .select(PRODUCT_SELECT)
        .maybeSingle();

      if (response.error !== null) {
        if (isUniqueViolation(response.error)) {
          throw new MerchantProductSlugConflictError();
        }

        throw new MerchantProductGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableProduct(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async archiveProduct(
    shopId: string,
    productId: string,
    deletedAt: string,
  ): Promise<boolean> {
    try {
      const response = await this.trustedClient
        .from('products')
        .update({
          is_active: false,
          deleted_at: deletedAt,
        })
        .eq('shop_id', shopId)
        .eq('id', productId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantProductGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return data !== null;
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
