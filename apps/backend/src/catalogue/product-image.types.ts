export const PRODUCT_IMAGE_TYPES = [
  'FRONT',
  'BACK',
  'SIDE',
  'DETAIL',
  'MODEL',
  'SIZE_CHART',
] as const;

export type ProductImageType = (typeof PRODUCT_IMAGE_TYPES)[number];

export const PRODUCT_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProductImageContentType = (typeof PRODUCT_IMAGE_CONTENT_TYPES)[number];

export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface MerchantProductImageRecord {
  readonly id: string;
  readonly productId: string;
  readonly variantId: null;
  readonly storageObjectKey: string;
  readonly thumbnailObjectKey: string | null;
  readonly imageType: ProductImageType;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly createdAt: string;
}

export interface MerchantProductImageSnapshot extends MerchantProductImageRecord {
  readonly imageUrl: string;
  readonly thumbnailUrl: string | null;
}

export interface CreateProductImageUploadIntentInput {
  readonly contentType: ProductImageContentType;
  readonly contentLength: number;
}

export interface FinalizeMerchantProductImageInput {
  readonly storageObjectKey: string;
  readonly imageType: ProductImageType;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
}

export interface UpdateMerchantProductImageInput {
  readonly imageType?: ProductImageType;
  readonly altText?: string | null;
  readonly displayOrder?: number;
  readonly isPrimary?: true;
  readonly widthPx?: number | null;
  readonly heightPx?: number | null;
}

export interface ReplaceMerchantProductImageInput {
  readonly imageType: ProductImageType;
  readonly altText: string | null;
  readonly displayOrder: number;
  readonly isPrimary: boolean;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
}

export interface DeletedMerchantProductImage {
  readonly id: string;
  readonly storageObjectKey: string;
  readonly thumbnailObjectKey: string | null;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ProductImageUploadIntentResponse {
  readonly success: true;
  readonly data: {
    readonly objectKey: string;
    readonly uploadUrl: string;
    readonly expiresAt: string;
    readonly contentType: ProductImageContentType;
    readonly maximumBytes: number;
  };
  readonly meta: ResponseMeta;
}

export interface ListMerchantProductImagesResponse {
  readonly success: true;
  readonly data: {
    readonly images: readonly MerchantProductImageSnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface MerchantProductImageResponse {
  readonly success: true;
  readonly data: {
    readonly image: MerchantProductImageSnapshot;
  };
  readonly meta: ResponseMeta;
}

export interface DeleteMerchantProductImageResponse {
  readonly success: true;
  readonly data: {
    readonly deletedImageId: string;
  };
  readonly meta: ResponseMeta;
}
