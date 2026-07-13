export const PRODUCT_GENDER_CATEGORIES = ['MEN', 'WOMEN', 'KIDS', 'UNISEX'] as const;

export type ProductGenderCategory = (typeof PRODUCT_GENDER_CATEGORIES)[number];

export const PRODUCT_MODERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUIRED',
] as const;

export type ProductModerationStatus = (typeof PRODUCT_MODERATION_STATUSES)[number];

export interface MerchantProductSnapshot {
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
  readonly moderationStatus: ProductModerationStatus;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface CreateMerchantProductInput {
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
  readonly isActive: boolean;
}

export interface UpdateMerchantProductInput {
  readonly categoryId?: string;
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly brand?: string | null;
  readonly material?: string | null;
  readonly genderCategory?: ProductGenderCategory;
  readonly styleTags?: readonly string[];
  readonly occasionTags?: readonly string[];
  readonly careInstructions?: string | null;
  readonly returnEligible?: boolean;
  readonly returnWindowDays?: number;
  readonly isActive?: boolean;
}

export interface ParsedMerchantProductUpdate {
  readonly input: UpdateMerchantProductInput;
  readonly moderationRelevant: boolean;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantProductsResponse {
  readonly success: true;
  readonly data: {
    readonly products: readonly MerchantProductSnapshot[];
  };
  readonly meta: ResponseMeta;
}

export interface MerchantProductResponse {
  readonly success: true;
  readonly data: {
    readonly product: MerchantProductSnapshot;
  };
  readonly meta: ResponseMeta;
}

export interface ArchiveMerchantProductResponse {
  readonly success: true;
  readonly data: {
    readonly archivedProductId: string;
  };
  readonly meta: ResponseMeta;
}
