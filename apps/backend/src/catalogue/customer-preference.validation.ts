import {
  PRODUCT_GENDER_CATEGORIES,
  type ProductGenderCategory,
} from './merchant-product.types';
import type { ReplaceCustomerPreferencesInput } from './customer-preference.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COLOUR_PATTERN = /^#[0-9a-f]{6}$/iu;
const MAX_PRICE_PAISE = Number.MAX_SAFE_INTEGER;
const ALLOWED_KEYS = new Set([
  'genderCategories',
  'styleTags',
  'occasionTags',
  'preferredColours',
  'preferredSizes',
  'minPricePaise',
  'maxPricePaise',
]);

export class CustomerPreferenceValidationError extends Error {
  public constructor() {
    super('Customer preference request is invalid');
    this.name = 'CustomerPreferenceValidationError';
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerPreferenceValidationError();
  }

  const record = value as Record<string, unknown>;

  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new CustomerPreferenceValidationError();
  }

  return record;
}

function parseTextArray(
  record: Record<string, unknown>,
  key: string,
  maxItems: number,
  maxLength: number,
  transform: (value: string) => string = (value) => value,
): readonly string[] {
  const value = record[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new CustomerPreferenceValidationError();
  }

  const normalized: string[] = [];
  const identities = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      throw new CustomerPreferenceValidationError();
    }

    const candidate = transform(item.trim());
    const identity = candidate.toLocaleLowerCase('en-US');

    if (
      candidate.length === 0 ||
      candidate.length > maxLength ||
      identities.has(identity)
    ) {
      throw new CustomerPreferenceValidationError();
    }

    identities.add(identity);
    normalized.push(candidate);
  }

  return normalized;
}

function parseGenderCategories(
  record: Record<string, unknown>,
): readonly ProductGenderCategory[] {
  const value = record['genderCategories'];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > PRODUCT_GENDER_CATEGORIES.length) {
    throw new CustomerPreferenceValidationError();
  }

  const parsed: ProductGenderCategory[] = [];
  const seen = new Set<ProductGenderCategory>();

  for (const item of value) {
    if (
      typeof item !== 'string' ||
      !PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === item) ||
      seen.has(item as ProductGenderCategory)
    ) {
      throw new CustomerPreferenceValidationError();
    }

    const category = item as ProductGenderCategory;
    seen.add(category);
    parsed.push(category);
  }

  return parsed;
}

function parseNullablePrice(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_PAISE
  ) {
    throw new CustomerPreferenceValidationError();
  }

  return value;
}

export function parseCustomerShopId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CustomerPreferenceValidationError();
  }

  return value.toLowerCase();
}

export function parseReplaceCustomerPreferencesInput(
  value: unknown,
): ReplaceCustomerPreferencesInput {
  const record = requireRecord(value);
  const minPricePaise = parseNullablePrice(record, 'minPricePaise');
  const maxPricePaise = parseNullablePrice(record, 'maxPricePaise');

  if (
    minPricePaise !== null &&
    maxPricePaise !== null &&
    minPricePaise > maxPricePaise
  ) {
    throw new CustomerPreferenceValidationError();
  }

  const preferredColours = parseTextArray(
    record,
    'preferredColours',
    12,
    7,
    (colour) => colour.toUpperCase(),
  );

  if (preferredColours.some((colour) => !COLOUR_PATTERN.test(colour))) {
    throw new CustomerPreferenceValidationError();
  }

  return {
    genderCategories: parseGenderCategories(record),
    styleTags: parseTextArray(record, 'styleTags', 20, 40),
    occasionTags: parseTextArray(record, 'occasionTags', 20, 40),
    preferredColours,
    preferredSizes: parseTextArray(record, 'preferredSizes', 20, 20),
    minPricePaise,
    maxPricePaise,
  };
}
