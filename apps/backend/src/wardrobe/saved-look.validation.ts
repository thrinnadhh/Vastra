import type {
  CreateSavedLookInput,
  LookItemInput,
  UpdateSavedLookInput,
} from './saved-look.types';
import {
  parseWardrobeIdempotencyKey,
  parseWardrobeUuid,
  WardrobeValidationError,
} from './wardrobe-item.validation';

const CREATE_KEYS = new Set(['name', 'items']);
const UPDATE_KEYS = new Set(['name', 'items']);
const ITEM_KEYS = new Set(['sourceType', 'wardrobeItemId', 'productVariantId']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') throw new WardrobeValidationError();
  const name = value.trim();
  if (name.length < 1 || name.length > 120) throw new WardrobeValidationError();
  return name;
}

function parseItems(value: unknown): LookItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new WardrobeValidationError();
  }

  return value.map((raw): LookItemInput => {
    if (!isRecord(raw) || Object.keys(raw).some((key) => !ITEM_KEYS.has(key))) {
      throw new WardrobeValidationError();
    }
    if (raw['sourceType'] === 'WARDROBE_ITEM') {
      if (raw['productVariantId'] !== null && raw['productVariantId'] !== undefined) {
        throw new WardrobeValidationError();
      }
      return {
        sourceType: 'WARDROBE_ITEM',
        wardrobeItemId: parseWardrobeUuid(raw['wardrobeItemId']),
        productVariantId: null,
      };
    }
    if (raw['sourceType'] === 'PRODUCT_VARIANT') {
      if (raw['wardrobeItemId'] !== null && raw['wardrobeItemId'] !== undefined) {
        throw new WardrobeValidationError();
      }
      return {
        sourceType: 'PRODUCT_VARIANT',
        wardrobeItemId: null,
        productVariantId: parseWardrobeUuid(raw['productVariantId']),
      };
    }
    throw new WardrobeValidationError();
  });
}

export function parseCreateSavedLookInput(
  body: unknown,
  idempotencyKeyValue: unknown,
): CreateSavedLookInput {
  if (!isRecord(body) || Object.keys(body).some((key) => !CREATE_KEYS.has(key))) {
    throw new WardrobeValidationError();
  }
  return {
    name: parseName(body['name']),
    items: parseItems(body['items']),
    idempotencyKey: parseWardrobeIdempotencyKey(idempotencyKeyValue),
  };
}

export function parseUpdateSavedLookInput(body: unknown): UpdateSavedLookInput {
  if (!isRecord(body) || Object.keys(body).length === 0 || Object.keys(body).some((key) => !UPDATE_KEYS.has(key))) {
    throw new WardrobeValidationError();
  }
  const input: { name?: string; items?: LookItemInput[] } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) input.name = parseName(body['name']);
  if (Object.prototype.hasOwnProperty.call(body, 'items')) input.items = parseItems(body['items']);
  return input;
}
