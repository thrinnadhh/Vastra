export const WARDROBE_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type WardrobeImageContentType = (typeof WARDROBE_IMAGE_CONTENT_TYPES)[number];

export const WARDROBE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface CreateWardrobeUploadIntentInput {
  readonly contentType: WardrobeImageContentType;
  readonly contentLength: number;
  readonly idempotencyKey: string;
}

export interface WardrobeUploadIntentRecord {
  readonly uploadId: string;
  readonly objectKey: string;
  readonly expiresAt: string;
  readonly replayed: boolean;
}

export interface WardrobeUploadIntent {
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}
