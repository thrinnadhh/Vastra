import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  PRODUCT_IMAGE_TYPES,
  type DeletedMerchantProductImage,
  type FinalizeMerchantProductImageInput,
  type MerchantProductImageRecord,
  type MerchantProductImageSnapshot,
  type ProductImageType,
  type ReplaceMerchantProductImageInput,
} from './product-image.types';

const PRODUCT_MEDIA_BUCKET = 'catalogue-media';

export interface ProductImageGateway {
  findOwnedImages(
    client: SupabaseClient,
    productId: string,
  ): Promise<readonly MerchantProductImageSnapshot[]>;

  findOwnedImageById(
    client: SupabaseClient,
    productId: string,
    imageId: string,
  ): Promise<MerchantProductImageSnapshot | null>;

  createSignedUploadUrl(objectKey: string): Promise<string>;

  objectExists(objectKey: string): Promise<boolean>;

  createImage(
    shopId: string,
    productId: string,
    input: FinalizeMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot>;

  updateImage(
    shopId: string,
    productId: string,
    imageId: string,
    input: ReplaceMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot | null>;

  deleteImage(
    shopId: string,
    productId: string,
    imageId: string,
  ): Promise<DeletedMerchantProductImage | null>;

  removeObjectsBestEffort(objectKeys: readonly string[]): Promise<void>;
}

export class ProductImageGatewayUnavailableError extends Error {
  public constructor() {
    super('Product image provider unavailable');
    this.name = 'ProductImageGatewayUnavailableError';
  }
}

export class ProductImageDataInvalidError extends Error {
  public constructor() {
    super('Product image data invalid');
    this.name = 'ProductImageDataInvalidError';
  }
}

export class ProductImageConflictError extends Error {
  public constructor() {
    super('Product image conflicts with existing media');
    this.name = 'ProductImageConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProductImageDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ProductImageDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new ProductImageDataInvalidError();
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
    throw new ProductImageDataInvalidError();
  }

  return value;
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
    throw new ProductImageDataInvalidError();
  }

  return value;
}

function isImageType(value: unknown): value is ProductImageType {
  return typeof value === 'string' && PRODUCT_IMAGE_TYPES.some((candidate) => candidate === value);
}

function parseImageRecord(value: unknown): MerchantProductImageRecord {
  if (!isRecord(value)) {
    throw new ProductImageDataInvalidError();
  }

  const variantId = value['variant_id'];
  const imageType = value['image_type'];

  if (variantId !== null || !isImageType(imageType)) {
    throw new ProductImageDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'product_id'),
    variantId: null,
    storageObjectKey: requireString(value, 'storage_object_key'),
    thumbnailObjectKey: requireNullableString(value, 'thumbnail_object_key'),
    imageType,
    altText: requireNullableString(value, 'alt_text'),
    displayOrder: requireSafeNonNegativeInteger(value, 'display_order'),
    isPrimary: requireBoolean(value, 'is_primary'),
    widthPx: requireNullablePositiveInteger(value, 'width_px'),
    heightPx: requireNullablePositiveInteger(value, 'height_px'),
    createdAt: requireString(value, 'created_at'),
  };
}

function parseDeletedImage(value: unknown): DeletedMerchantProductImage | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new ProductImageDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    storageObjectKey: requireString(value, 'storage_object_key'),
    thumbnailObjectKey: requireNullableString(value, 'thumbnail_object_key'),
  };
}

function isUniqueViolation(value: unknown): boolean {
  return isRecord(value) && value['code'] === '23505';
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof ProductImageGatewayUnavailableError ||
    error instanceof ProductImageDataInvalidError ||
    error instanceof ProductImageConflictError
  ) {
    throw error;
  }

  throw new ProductImageGatewayUnavailableError();
}

const PRODUCT_IMAGE_SELECT = [
  'id',
  'product_id',
  'variant_id',
  'storage_object_key',
  'thumbnail_object_key',
  'image_type',
  'alt_text',
  'display_order',
  'is_primary',
  'width_px',
  'height_px',
  'created_at',
].join(', ');

@Injectable()
export class SupabaseProductImageGateway implements ProductImageGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findOwnedImages(
    client: SupabaseClient,
    productId: string,
  ): Promise<readonly MerchantProductImageSnapshot[]> {
    try {
      const response = await client
        .from('product_images')
        .select(PRODUCT_IMAGE_SELECT)
        .eq('product_id', productId)
        .is('variant_id', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (response.error !== null) {
        throw new ProductImageGatewayUnavailableError();
      }

      const data: unknown = response.data;

      if (!Array.isArray(data)) {
        throw new ProductImageDataInvalidError();
      }

      return data.map((value) => this.decorateImage(parseImageRecord(value)));
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findOwnedImageById(
    client: SupabaseClient,
    productId: string,
    imageId: string,
  ): Promise<MerchantProductImageSnapshot | null> {
    try {
      const response = await client
        .from('product_images')
        .select(PRODUCT_IMAGE_SELECT)
        .eq('product_id', productId)
        .eq('id', imageId)
        .is('variant_id', null)
        .maybeSingle();

      if (response.error !== null) {
        throw new ProductImageGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return data === null ? null : this.decorateImage(parseImageRecord(data));
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createSignedUploadUrl(objectKey: string): Promise<string> {
    try {
      const response = await this.trustedClient.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .createSignedUploadUrl(objectKey, { upsert: false });

      if (response.data === null) {
        throw new ProductImageGatewayUnavailableError();
      }

      return response.data.signedUrl;
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async objectExists(objectKey: string): Promise<boolean> {
    try {
      const separatorIndex = objectKey.lastIndexOf('/');

      if (separatorIndex <= 0 || separatorIndex === objectKey.length - 1) {
        throw new ProductImageDataInvalidError();
      }

      const directory = objectKey.slice(0, separatorIndex);
      const fileName = objectKey.slice(separatorIndex + 1);
      const response = await this.trustedClient.storage.from(PRODUCT_MEDIA_BUCKET).list(directory, {
        limit: 100,
        search: fileName,
      });

      if (response.data === null) {
        throw new ProductImageGatewayUnavailableError();
      }

      return response.data.some((entry) => entry.name === fileName);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createImage(
    shopId: string,
    productId: string,
    input: FinalizeMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot> {
    try {
      const response = await this.trustedClient.rpc('catalogue_create_product_image', {
        p_shop_id: shopId,
        p_product_id: productId,
        p_storage_object_key: input.storageObjectKey,
        p_image_type: input.imageType,
        p_alt_text: input.altText,
        p_display_order: input.displayOrder,
        p_is_primary: input.isPrimary,
        p_width_px: input.widthPx,
        p_height_px: input.heightPx,
      });

      if (response.error !== null) {
        if (isUniqueViolation(response.error)) {
          throw new ProductImageConflictError();
        }

        throw new ProductImageGatewayUnavailableError();
      }

      return this.decorateImage(parseImageRecord(response.data));
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async updateImage(
    shopId: string,
    productId: string,
    imageId: string,
    input: ReplaceMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot | null> {
    try {
      const response = await this.trustedClient.rpc('catalogue_update_product_image', {
        p_shop_id: shopId,
        p_product_id: productId,
        p_image_id: imageId,
        p_image_type: input.imageType,
        p_alt_text: input.altText,
        p_display_order: input.displayOrder,
        p_is_primary: input.isPrimary,
        p_width_px: input.widthPx,
        p_height_px: input.heightPx,
      });

      if (response.error !== null) {
        if (isUniqueViolation(response.error)) {
          throw new ProductImageConflictError();
        }

        throw new ProductImageGatewayUnavailableError();
      }

      return response.data === null ? null : this.decorateImage(parseImageRecord(response.data));
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async deleteImage(
    shopId: string,
    productId: string,
    imageId: string,
  ): Promise<DeletedMerchantProductImage | null> {
    try {
      const response = await this.trustedClient.rpc('catalogue_delete_product_image', {
        p_shop_id: shopId,
        p_product_id: productId,
        p_image_id: imageId,
      });

      if (response.error !== null) {
        throw new ProductImageGatewayUnavailableError();
      }

      return parseDeletedImage(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async removeObjectsBestEffort(objectKeys: readonly string[]): Promise<void> {
    if (objectKeys.length === 0) {
      return;
    }

    try {
      await this.trustedClient.storage.from(PRODUCT_MEDIA_BUCKET).remove([...objectKeys]);
    } catch {
      // The database deletion is authoritative. Orphan cleanup can be retried later.
    }
  }

  private decorateImage(record: MerchantProductImageRecord): MerchantProductImageSnapshot {
    return {
      ...record,
      imageUrl: this.publicUrl(record.storageObjectKey),
      thumbnailUrl:
        record.thumbnailObjectKey === null ? null : this.publicUrl(record.thumbnailObjectKey),
    };
  }

  private publicUrl(objectKey: string): string {
    return this.trustedClient.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(objectKey).data
      .publicUrl;
  }
}
