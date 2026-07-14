import { Buffer } from 'node:buffer';

import { PRODUCT_GENDER_CATEGORIES, type ProductGenderCategory } from './merchant-product.types';
import {
  CUSTOMER_PRODUCT_SEARCH_SORTS,
  type CustomerProductSearchQuery,
  type CustomerProductSearchSort,
} from './customer-product-search.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1_000_000;
const MAX_PRICE_PAISE = Number.MAX_SAFE_INTEGER;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NON_NEGATIVE_INTEGER_PATTERN = /^(0|[1-9][0-9]*)$/u;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class CustomerProductSearchValidationError extends Error {
  public constructor() {
    super('Customer product-search query is invalid');
    this.name = 'CustomerProductSearchValidationError';
  }
}

function parseSearchTerm(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerProductSearchValidationError();
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized.length < 2 || normalized.length > 100) {
    throw new CustomerProductSearchValidationError();
  }

  return normalized;
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerProductSearchValidationError();
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new CustomerProductSearchValidationError();
  }

  return parsed;
}

function parseOptionalUuid(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerProductSearchValidationError();
  }

  const normalized = value.trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerProductSearchValidationError();
  }

  return normalized;
}

function parseOptionalGender(value: unknown): ProductGenderCategory | null {
  if (value === undefined) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !PRODUCT_GENDER_CATEGORIES.some((candidate) => candidate === value)
  ) {
    throw new CustomerProductSearchValidationError();
  }

  return value as ProductGenderCategory;
}

function parseOptionalPrice(value: unknown): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !NON_NEGATIVE_INTEGER_PATTERN.test(value)) {
    throw new CustomerProductSearchValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_PRICE_PAISE) {
    throw new CustomerProductSearchValidationError();
  }

  return parsed;
}

function parseAvailableOnly(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new CustomerProductSearchValidationError();
}

function parseSort(value: unknown): CustomerProductSearchSort {
  if (value === undefined) {
    return 'RELEVANCE';
  }

  if (
    typeof value !== 'string' ||
    !CUSTOMER_PRODUCT_SEARCH_SORTS.some((candidate) => candidate === value)
  ) {
    throw new CustomerProductSearchValidationError();
  }

  return value as CustomerProductSearchSort;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new CustomerProductSearchValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_LIMIT) {
    throw new CustomerProductSearchValidationError();
  }

  return parsed;
}

function parseCursor(value: unknown): number {
  if (value === undefined) {
    return 0;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new CustomerProductSearchValidationError();
  }

  let decoded: string;

  try {
    decoded = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new CustomerProductSearchValidationError();
  }

  if (Buffer.from(decoded, 'utf8').toString('base64url') !== value || !decoded.startsWith('v1:')) {
    throw new CustomerProductSearchValidationError();
  }

  const rawOffset = decoded.slice(3);

  if (!NON_NEGATIVE_INTEGER_PATTERN.test(rawOffset)) {
    throw new CustomerProductSearchValidationError();
  }

  const offset = Number(rawOffset);

  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new CustomerProductSearchValidationError();
  }

  return offset;
}

export function parseCustomerProductSearchQuery(
  termValue: unknown,
  latitudeValue: unknown,
  longitudeValue: unknown,
  categoryIdValue: unknown,
  genderValue: unknown,
  shopIdValue: unknown,
  minPriceValue: unknown,
  maxPriceValue: unknown,
  availableOnlyValue: unknown,
  sortValue: unknown,
  cursorValue: unknown,
  limitValue: unknown,
): CustomerProductSearchQuery {
  const minPricePaise = parseOptionalPrice(minPriceValue);
  const maxPricePaise = parseOptionalPrice(maxPriceValue);

  if (minPricePaise !== null && maxPricePaise !== null && minPricePaise > maxPricePaise) {
    throw new CustomerProductSearchValidationError();
  }

  return {
    term: parseSearchTerm(termValue),
    latitude: parseCoordinate(latitudeValue, -90, 90),
    longitude: parseCoordinate(longitudeValue, -180, 180),
    categoryId: parseOptionalUuid(categoryIdValue),
    genderCategory: parseOptionalGender(genderValue),
    shopId: parseOptionalUuid(shopIdValue),
    minPricePaise,
    maxPricePaise,
    availableOnly: parseAvailableOnly(availableOnlyValue),
    sort: parseSort(sortValue),
    offset: parseCursor(cursorValue),
    limit: parseLimit(limitValue),
  };
}
