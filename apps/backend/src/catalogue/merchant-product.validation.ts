import {
  PRODUCT_GENDER_CATEGORIES,
  type CreateMerchantProductInput,
  type ParsedMerchantProductUpdate,
  type ProductGenderCategory,
} from './merchant-product.types';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const MUTABLE_KEYS = new Set([
  'categoryId',
  'name',
  'slug',
  'description',
  'brand',
  'material',
  'genderCategory',
  'styleTags',
  'occasionTags',
  'careInstructions',
  'returnEligible',
  'returnWindowDays',
  'isActive',
]);

export class MerchantProductValidationError extends Error {
  public constructor() {
    super('Merchant product request is invalid');
    this.name = 'MerchantProductValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOnlyMutableKeys(record: Record<string, unknown>): void {
  if (Object.keys(record).some((key) => !MUTABLE_KEYS.has(key))) {
    throw new MerchantProductValidationError();
  }
}

function requireTrimmedString(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new MerchantProductValidationError();
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maximumLength) {
    throw new MerchantProductValidationError();
  }

  return trimmed;
}

function requireSlug(value: unknown): string {
  const slug = requireTrimmedString(value, 200);

  if (!SLUG_PATTERN.test(slug)) {
    throw new MerchantProductValidationError();
  }

  return slug;
}

function requireNullableTrimmedString(value: unknown, maximumLength: number): string | null {
  if (value === null) {
    return null;
  }

  return requireTrimmedString(value, maximumLength);
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new MerchantProductValidationError();
  }

  return value;
}

function requireReturnWindowDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 90) {
    throw new MerchantProductValidationError();
  }

  return value;
}

function isGenderCategory(value: unknown): value is ProductGenderCategory {
  return (
    typeof value === 'string' && PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === value)
  );
}

function requireGenderCategory(value: unknown): ProductGenderCategory {
  if (!isGenderCategory(value)) {
    throw new MerchantProductValidationError();
  }

  return value;
}

function requireTags(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 30) {
    throw new MerchantProductValidationError();
  }

  const normalized = value.map((tag) => requireTrimmedString(tag, 80));

  if (new Set(normalized).size !== normalized.length) {
    throw new MerchantProductValidationError();
  }

  return normalized;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function parseCreateMerchantProductBody(value: unknown): CreateMerchantProductInput {
  if (!isRecord(value)) {
    throw new MerchantProductValidationError();
  }

  assertOnlyMutableKeys(value);

  if (!hasOwn(value, 'categoryId') || !hasOwn(value, 'name') || !hasOwn(value, 'slug')) {
    throw new MerchantProductValidationError();
  }

  return {
    categoryId: requireTrimmedString(value['categoryId'], 100),
    name: requireTrimmedString(value['name'], 200),
    slug: requireSlug(value['slug']),
    description: hasOwn(value, 'description')
      ? requireNullableTrimmedString(value['description'], 4000)
      : null,
    brand: hasOwn(value, 'brand') ? requireNullableTrimmedString(value['brand'], 200) : null,
    material: hasOwn(value, 'material')
      ? requireNullableTrimmedString(value['material'], 200)
      : null,
    genderCategory: hasOwn(value, 'genderCategory')
      ? requireGenderCategory(value['genderCategory'])
      : 'UNISEX',
    styleTags: hasOwn(value, 'styleTags') ? requireTags(value['styleTags']) : [],
    occasionTags: hasOwn(value, 'occasionTags') ? requireTags(value['occasionTags']) : [],
    careInstructions: hasOwn(value, 'careInstructions')
      ? requireNullableTrimmedString(value['careInstructions'], 2000)
      : null,
    returnEligible: hasOwn(value, 'returnEligible')
      ? requireBoolean(value['returnEligible'])
      : true,
    returnWindowDays: hasOwn(value, 'returnWindowDays')
      ? requireReturnWindowDays(value['returnWindowDays'])
      : 7,
    isActive: hasOwn(value, 'isActive') ? requireBoolean(value['isActive']) : true,
  };
}

interface MutableMerchantProductUpdate {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  material?: string | null;
  genderCategory?: ProductGenderCategory;
  styleTags?: readonly string[];
  occasionTags?: readonly string[];
  careInstructions?: string | null;
  returnEligible?: boolean;
  returnWindowDays?: number;
  isActive?: boolean;
}

export function parseUpdateMerchantProductBody(value: unknown): ParsedMerchantProductUpdate {
  if (!isRecord(value)) {
    throw new MerchantProductValidationError();
  }

  assertOnlyMutableKeys(value);

  const keys = Object.keys(value);

  if (keys.length === 0) {
    throw new MerchantProductValidationError();
  }

  const input: MutableMerchantProductUpdate = {};

  if (hasOwn(value, 'categoryId')) {
    input.categoryId = requireTrimmedString(value['categoryId'], 100);
  }

  if (hasOwn(value, 'name')) {
    input.name = requireTrimmedString(value['name'], 200);
  }

  if (hasOwn(value, 'slug')) {
    input.slug = requireSlug(value['slug']);
  }

  if (hasOwn(value, 'description')) {
    input.description = requireNullableTrimmedString(value['description'], 4000);
  }

  if (hasOwn(value, 'brand')) {
    input.brand = requireNullableTrimmedString(value['brand'], 200);
  }

  if (hasOwn(value, 'material')) {
    input.material = requireNullableTrimmedString(value['material'], 200);
  }

  if (hasOwn(value, 'genderCategory')) {
    input.genderCategory = requireGenderCategory(value['genderCategory']);
  }

  if (hasOwn(value, 'styleTags')) {
    input.styleTags = requireTags(value['styleTags']);
  }

  if (hasOwn(value, 'occasionTags')) {
    input.occasionTags = requireTags(value['occasionTags']);
  }

  if (hasOwn(value, 'careInstructions')) {
    input.careInstructions = requireNullableTrimmedString(value['careInstructions'], 2000);
  }

  if (hasOwn(value, 'returnEligible')) {
    input.returnEligible = requireBoolean(value['returnEligible']);
  }

  if (hasOwn(value, 'returnWindowDays')) {
    input.returnWindowDays = requireReturnWindowDays(value['returnWindowDays']);
  }

  if (hasOwn(value, 'isActive')) {
    input.isActive = requireBoolean(value['isActive']);
  }

  return {
    input,
    moderationRelevant: keys.some((key) => key !== 'isActive'),
  };
}
