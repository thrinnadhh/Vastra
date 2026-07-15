import type { CreateWardrobeItemInput, UpdateWardrobeItemInput } from './wardrobe-item.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CREATE_KEYS = new Set(['uploadId', 'category', 'colour', 'occasion', 'season', 'notes']);
const UPDATE_KEYS = new Set(['category', 'colour', 'occasion', 'season', 'notes']);

export class WardrobeValidationError extends Error {
  public constructor() {
    super('Wardrobe request is invalid');
    this.name = 'WardrobeValidationError';
  }
}

export class WardrobeIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Wardrobe idempotency key is required');
    this.name = 'WardrobeIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseWardrobeUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new WardrobeValidationError();
  }

  const normalized = value.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalized)) {
    throw new WardrobeValidationError();
  }

  return normalized;
}

export function parseWardrobeIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new WardrobeIdempotencyKeyRequiredError();
  }

  return parseWardrobeUuid(value);
}

function parseRequiredText(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new WardrobeValidationError();
  }

  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > maximumLength) {
    throw new WardrobeValidationError();
  }

  return normalized;
}

function parseNullableNotes(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new WardrobeValidationError();
  }

  const normalized = value.trim();

  if (normalized.length > 500) {
    throw new WardrobeValidationError();
  }

  return normalized.length === 0 ? null : normalized;
}

export function parseCreateWardrobeItemInput(
  body: unknown,
  idempotencyKeyValue: unknown,
): CreateWardrobeItemInput {
  if (!isRecord(body) || Object.keys(body).some((key) => !CREATE_KEYS.has(key))) {
    throw new WardrobeValidationError();
  }

  return {
    uploadId: parseWardrobeUuid(body['uploadId']),
    category: parseRequiredText(body['category'], 80),
    colour: parseRequiredText(body['colour'], 80),
    occasion: parseRequiredText(body['occasion'], 80),
    season: parseRequiredText(body['season'], 80),
    notes: parseNullableNotes(body['notes']),
    idempotencyKey: parseWardrobeIdempotencyKey(idempotencyKeyValue),
  };
}

export function parseUpdateWardrobeItemInput(body: unknown): UpdateWardrobeItemInput {
  if (
    !isRecord(body) ||
    Object.keys(body).length === 0 ||
    Object.keys(body).some((key) => !UPDATE_KEYS.has(key))
  ) {
    throw new WardrobeValidationError();
  }

  const input: {
    category?: string;
    colour?: string;
    occasion?: string;
    season?: string;
    notes?: string | null;
  } = {};

  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    input.category = parseRequiredText(body['category'], 80);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'colour')) {
    input.colour = parseRequiredText(body['colour'], 80);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'occasion')) {
    input.occasion = parseRequiredText(body['occasion'], 80);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'season')) {
    input.season = parseRequiredText(body['season'], 80);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    input.notes = parseNullableNotes(body['notes']);
  }

  return input;
}
