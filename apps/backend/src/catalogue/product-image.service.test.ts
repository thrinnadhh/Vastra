import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantProductService } from './merchant-product.service';
import {
  type ProductImageGateway,
  ProductImageGatewayUnavailableError,
} from './product-image.gateway';
import { ProductImageService } from './product-image.service';
import type {
  DeletedMerchantProductImage,
  FinalizeMerchantProductImageInput,
  MerchantProductImageSnapshot,
  ReplaceMerchantProductImageInput,
} from './product-image.types';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const IMAGE_ID = '50000000-0000-4000-8000-000000000001';
const OBJECT_KEY = `catalogue/${SHOP_ID}/${PRODUCT_ID}/image.webp`;
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

function createContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: '10000000-0000-4000-8000-000000000001',
      email: 'merchant@example.test',
      accountType: 'MERCHANT',
      status: 'ACTIVE',
    },
    accessToken: 'merchant-token',
    supabase: emptyClient,
  };
}

function createImage(
  overrides: Partial<MerchantProductImageSnapshot> = {},
): MerchantProductImageSnapshot {
  return {
    id: IMAGE_ID,
    productId: PRODUCT_ID,
    variantId: null,
    storageObjectKey: OBJECT_KEY,
    thumbnailObjectKey: null,
    imageType: 'FRONT',
    altText: 'Blue kurta front',
    displayOrder: 0,
    isPrimary: true,
    widthPx: 1200,
    heightPx: 1600,
    createdAt: '2026-07-13T00:00:00.000Z',
    imageUrl: 'https://example.test/catalogue/image.webp',
    thumbnailUrl: null,
    ...overrides,
  };
}

class RecordingProductImageGateway implements ProductImageGateway {
  public calls: string[] = [];
  public objectUploaded = true;
  public unavailable = false;
  public image: MerchantProductImageSnapshot | null = createImage();
  public deleted: DeletedMerchantProductImage | null = {
    id: IMAGE_ID,
    storageObjectKey: OBJECT_KEY,
    thumbnailObjectKey: null,
  };
  public lastCreateInput: FinalizeMerchantProductImageInput | null = null;
  public lastUpdateInput: ReplaceMerchantProductImageInput | null = null;
  public cleanedKeys: readonly string[] = [];

  public findOwnedImages(): Promise<readonly MerchantProductImageSnapshot[]> {
    this.calls.push('list');

    if (this.unavailable) {
      return Promise.reject(new ProductImageGatewayUnavailableError());
    }

    return Promise.resolve(this.image === null ? [] : [this.image]);
  }

  public findOwnedImageById(): Promise<MerchantProductImageSnapshot | null> {
    this.calls.push('get');
    return Promise.resolve(this.image);
  }

  public createSignedUploadUrl(): Promise<string> {
    this.calls.push('signed-upload');
    return Promise.resolve('https://example.test/upload');
  }

  public objectExists(): Promise<boolean> {
    this.calls.push('object-exists');
    return Promise.resolve(this.objectUploaded);
  }

  public createImage(
    _shopId: string,
    _productId: string,
    input: FinalizeMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot> {
    this.calls.push('create');
    this.lastCreateInput = input;
    return Promise.resolve(createImage({ isPrimary: input.isPrimary }));
  }

  public updateImage(
    _shopId: string,
    _productId: string,
    _imageId: string,
    input: ReplaceMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot | null> {
    this.calls.push('update');
    this.lastUpdateInput = input;
    return Promise.resolve(this.image === null ? null : createImage(input));
  }

  public deleteImage(): Promise<DeletedMerchantProductImage | null> {
    this.calls.push('delete');
    return Promise.resolve(this.deleted);
  }

  public removeObjectsBestEffort(objectKeys: readonly string[]): Promise<void> {
    this.calls.push('cleanup');
    this.cleanedKeys = objectKeys;
    return Promise.resolve();
  }
}

function createProductService(): MerchantProductService {
  return {
    requireOwnedProduct: () => Promise.resolve({}),
  } as unknown as MerchantProductService;
}

function requireHttpErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected object response');
  }

  const bodyError = (response as Record<string, unknown>)['error'];

  if (typeof bodyError !== 'object' || bodyError === null || Array.isArray(bodyError)) {
    throw new TypeError('Expected error object');
  }

  const code = (bodyError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('ProductImageService', () => {
  let gateway: RecordingProductImageGateway;
  let service: ProductImageService;

  beforeEach(() => {
    gateway = new RecordingProductImageGateway();
    service = new ProductImageService(createProductService(), gateway);
  });

  it('lists owned product images', async () => {
    const response = await service.listImages(createContext(), SHOP_ID, PRODUCT_ID);

    expect(response.data.images).toStrictEqual([createImage()]);
    expect(gateway.calls).toStrictEqual(['list']);
  });

  it('creates a signed upload intent with an owner-scoped object key', async () => {
    const response = await service.createUploadIntent(createContext(), SHOP_ID, PRODUCT_ID, {
      contentType: 'image/webp',
      contentLength: 1024,
    });

    expect(response.data.objectKey).toMatch(
      new RegExp(`^catalogue/${SHOP_ID}/${PRODUCT_ID}/[0-9a-f-]+\\.webp$`, 'u'),
    );
    expect(response.data.uploadUrl).toBe('https://example.test/upload');
    expect(response.data.maximumBytes).toBe(10 * 1024 * 1024);
  });

  it('rejects finalization for an object outside the owned product prefix', async () => {
    await expect(
      service.finalizeImage(createContext(), SHOP_ID, PRODUCT_ID, {
        storageObjectKey: 'catalogue/other/product/image.webp',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'PRODUCT_IMAGE_UPLOAD_INVALID',
    );
  });

  it('rejects finalization when the uploaded object does not exist', async () => {
    gateway.objectUploaded = false;

    await expect(
      service.finalizeImage(createContext(), SHOP_ID, PRODUCT_ID, {
        storageObjectKey: OBJECT_KEY,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'PRODUCT_IMAGE_UPLOAD_INVALID',
    );
  });

  it('finalizes uploaded product media', async () => {
    const response = await service.finalizeImage(createContext(), SHOP_ID, PRODUCT_ID, {
      storageObjectKey: OBJECT_KEY,
      imageType: 'FRONT',
      altText: 'Blue kurta front',
      displayOrder: 0,
      isPrimary: true,
      widthPx: 1200,
      heightPx: 1600,
    });

    expect(response.data.image.id).toBe(IMAGE_ID);
    expect(gateway.lastCreateInput?.storageObjectKey).toBe(OBJECT_KEY);
    expect(gateway.calls).toStrictEqual(['object-exists', 'create']);
  });

  it('merges partial metadata and switches an image to primary', async () => {
    gateway.image = createImage({ isPrimary: false, displayOrder: 4 });

    const response = await service.updateImage(createContext(), SHOP_ID, PRODUCT_ID, IMAGE_ID, {
      displayOrder: 1,
      isPrimary: true,
    });

    expect(response.data.image.isPrimary).toBe(true);
    expect(gateway.lastUpdateInput).toStrictEqual({
      imageType: 'FRONT',
      altText: 'Blue kurta front',
      displayOrder: 1,
      isPrimary: true,
      widthPx: 1200,
      heightPx: 1600,
    });
  });

  it('deletes image metadata and requests best-effort object cleanup', async () => {
    const response = await service.deleteImage(createContext(), SHOP_ID, PRODUCT_ID, IMAGE_ID);

    expect(response.data.deletedImageId).toBe(IMAGE_ID);
    expect(gateway.cleanedKeys).toStrictEqual([OBJECT_KEY]);
    expect(gateway.calls).toStrictEqual(['delete', 'cleanup']);
  });

  it('maps provider failures to the catalogue 503 error', async () => {
    gateway.unavailable = true;

    await expect(service.listImages(createContext(), SHOP_ID, PRODUCT_ID)).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
