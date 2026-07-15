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

export interface WardrobeListCursor {
  readonly createdAt: string;
  readonly id: string;
}

export function parseWardrobeListLimit(value: unknown): number {
  if (value === undefined) return 20;
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new WardrobeValidationError();
  }
  return parsed;
}

export function parseWardrobeListCursor(value: unknown): WardrobeListCursor | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 512) throw new WardrobeValidationError();

  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!isRecord(decoded)) throw new WardrobeValidationError();
    const createdAt = decoded['createdAt'];
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
      throw new WardrobeValidationError();
    }
    return { createdAt, id: parseWardrobeUuid(decoded['id']) };
  } catch (error: unknown) {
    if (error instanceof WardrobeValidationError) throw error;
    throw new WardrobeValidationError();
  }
}

export function encodeWardrobeListCursor(cursor: WardrobeListCursor | null): string | null {
  if (cursor === null) return null;
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}
