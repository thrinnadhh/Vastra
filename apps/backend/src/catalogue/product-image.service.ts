import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidProductImageInputException,
  createProductImageConflictException,
  createProductImageNotFoundException,
  createProductImageUploadInvalidException,
} from './catalogue-http-error';
import { MerchantProductService } from './merchant-product.service';
import {
  type ProductImageGateway,
  ProductImageConflictError,
  ProductImageDataInvalidError,
  ProductImageGatewayUnavailableError,
} from './product-image.gateway';
import { PRODUCT_IMAGE_GATEWAY } from './product-image.tokens';
import type {
  DeleteMerchantProductImageResponse,
  ListMerchantProductImagesResponse,
  MerchantProductImageResponse,
  MerchantProductImageSnapshot,
  ProductImageUploadIntentResponse,
  ReplaceMerchantProductImageInput,
} from './product-image.types';
import { PRODUCT_IMAGE_MAX_BYTES } from './product-image.types';
import {
  extensionForProductImageContentType,
  parseFinalizeProductImageBody,
  parseProductImageUploadIntentBody,
  parseUpdateProductImageBody,
  ProductImageValidationError,
} from './product-image.validation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SIGNED_UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class ProductImageService {
  public constructor(
    @Inject(MerchantProductService)
    private readonly merchantProductService: MerchantProductService,
    @Inject(PRODUCT_IMAGE_GATEWAY)
    private readonly gateway: ProductImageGateway,
  ) {}

  public async listImages(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
  ): Promise<ListMerchantProductImagesResponse> {
    await this.merchantProductService.requireOwnedProduct(context, shopId, productId);

    try {
      const images = await this.gateway.findOwnedImages(context.supabase, productId);

      return {
        success: true,
        data: {
          images,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async createUploadIntent(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    body: unknown,
  ): Promise<ProductImageUploadIntentResponse> {
    await this.merchantProductService.requireOwnedProduct(context, shopId, productId);

    try {
      const input = parseProductImageUploadIntentBody(body);
      const extension = extensionForProductImageContentType(input.contentType);
      const objectKey = `catalogue/${shopId}/${productId}/${randomUUID()}.${extension}`;
      const uploadUrl = await this.gateway.createSignedUploadUrl(objectKey);

      return {
        success: true,
        data: {
          objectKey,
          uploadUrl,
          expiresAt: new Date(Date.now() + SIGNED_UPLOAD_LIFETIME_MS).toISOString(),
          contentType: input.contentType,
          maximumBytes: PRODUCT_IMAGE_MAX_BYTES,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async finalizeImage(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    body: unknown,
  ): Promise<MerchantProductImageResponse> {
    await this.merchantProductService.requireOwnedProduct(context, shopId, productId);

    try {
      const input = parseFinalizeProductImageBody(body);
      this.assertOwnedObjectKey(input.storageObjectKey, shopId, productId);

      if (!(await this.gateway.objectExists(input.storageObjectKey))) {
        throw createProductImageUploadInvalidException();
      }

      const image = await this.gateway.createImage(shopId, productId, input);
      return this.imageResponse(image);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async updateImage(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    imageId: string,
    body: unknown,
  ): Promise<MerchantProductImageResponse> {
    await this.merchantProductService.requireOwnedProduct(context, shopId, productId);
    this.assertImageId(imageId);

    try {
      const current = await this.requireOwnedImage(context, productId, imageId);
      const update = parseUpdateProductImageBody(body);
      const replacement: ReplaceMerchantProductImageInput = {
        imageType: update.imageType ?? current.imageType,
        altText: update.altText !== undefined ? update.altText : current.altText,
        displayOrder: update.displayOrder ?? current.displayOrder,
        isPrimary: update.isPrimary ?? current.isPrimary,
        widthPx: update.widthPx !== undefined ? update.widthPx : current.widthPx,
        heightPx: update.heightPx !== undefined ? update.heightPx : current.heightPx,
      };

      this.assertDimensionPair(replacement.widthPx, replacement.heightPx);

      const image = await this.gateway.updateImage(shopId, productId, imageId, replacement);

      if (image === null) {
        throw createProductImageNotFoundException();
      }

      return this.imageResponse(image);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async deleteImage(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    imageId: string,
  ): Promise<DeleteMerchantProductImageResponse> {
    await this.merchantProductService.requireOwnedProduct(context, shopId, productId);
    this.assertImageId(imageId);

    try {
      const deleted = await this.gateway.deleteImage(shopId, productId, imageId);

      if (deleted === null) {
        throw createProductImageNotFoundException();
      }

      const keys = [deleted.storageObjectKey];

      if (deleted.thumbnailObjectKey !== null) {
        keys.push(deleted.thumbnailObjectKey);
      }

      await this.gateway.removeObjectsBestEffort(keys);

      return {
        success: true,
        data: {
          deletedImageId: deleted.id,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private async requireOwnedImage(
    context: AuthenticatedRequestContext,
    productId: string,
    imageId: string,
  ): Promise<MerchantProductImageSnapshot> {
    const image = await this.gateway.findOwnedImageById(context.supabase, productId, imageId);

    if (image === null) {
      throw createProductImageNotFoundException();
    }

    return image;
  }

  private assertImageId(imageId: string): void {
    if (!UUID_PATTERN.test(imageId)) {
      throw createInvalidProductImageInputException();
    }
  }

  private assertOwnedObjectKey(objectKey: string, shopId: string, productId: string): void {
    const expectedPrefix = `catalogue/${shopId}/${productId}/`;

    if (
      !objectKey.startsWith(expectedPrefix) ||
      objectKey.includes('..') ||
      objectKey.endsWith('/')
    ) {
      throw createProductImageUploadInvalidException();
    }
  }

  private assertDimensionPair(widthPx: number | null, heightPx: number | null): void {
    if ((widthPx === null) !== (heightPx === null)) {
      throw createInvalidProductImageInputException();
    }
  }

  private imageResponse(image: MerchantProductImageSnapshot): MerchantProductImageResponse {
    return {
      success: true,
      data: {
        image,
      },
      meta: {
        requestId: null,
      },
    };
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof ProductImageValidationError) {
      throw createInvalidProductImageInputException();
    }

    if (error instanceof ProductImageConflictError) {
      throw createProductImageConflictException();
    }

    if (error instanceof ProductImageGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof ProductImageDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
