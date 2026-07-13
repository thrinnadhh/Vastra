import {
  MERCHANT_INVENTORY_ADJUSTMENT_ACTIONS,
  type CreateMerchantInventoryAdjustmentInput,
  type MerchantInventoryAdjustmentAction,
  type MerchantInventoryMovementQuery,
} from './merchant-inventory-adjustment.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/u;
const DEFAULT_MOVEMENT_LIMIT = 50;
const MAX_MOVEMENT_LIMIT = 100;
const MAX_REASON_LENGTH = 500;

const ADJUSTMENT_KEYS = new Set(['variantId', 'action', 'quantity', 'reason', 'expectedVersion']);

export class MerchantInventoryAdjustmentValidationError extends Error {
  public constructor() {
    super('Merchant inventory adjustment request is invalid');
    this.name = 'MerchantInventoryAdjustmentValidationError';
  }
}

export class MerchantInventoryMovementQueryValidationError extends Error {
  public constructor() {
    super('Merchant inventory movement query is invalid');
    this.name = 'MerchantInventoryMovementQueryValidationError';
  }
}

export class MerchantInventoryIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Merchant inventory adjustment requires an idempotency key');
    this.name = 'MerchantInventoryIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoUnknownKeys(record: Record<string, unknown>): void {
  if (Object.keys(record).some((key) => !ADJUSTMENT_KEYS.has(key))) {
    throw new MerchantInventoryAdjustmentValidationError();
  }
}

function containsDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
}

function parseVariantId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  const variantId = value.trim();

  if (!UUID_PATTERN.test(variantId)) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return variantId;
}

function parseAction(value: unknown): MerchantInventoryAdjustmentAction {
  if (
    typeof value !== 'string' ||
    !MERCHANT_INVENTORY_ADJUSTMENT_ACTIONS.some((action) => action === value)
  ) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return value as MerchantInventoryAdjustmentAction;
}

function parseQuantity(value: unknown, action: MerchantInventoryAdjustmentAction): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  const quantity = value;
  const permitsZero = action === 'STOCK_CORRECTION' || action === 'STOCK_CHECK';

  if (quantity < 0 || (!permitsZero && quantity === 0)) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return quantity;
}

function parseReason(value: unknown): string {
  if (typeof value !== 'string') {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  const reason = value.trim();

  if (
    reason.length === 0 ||
    reason.length > MAX_REASON_LENGTH ||
    containsDisallowedControlCharacter(reason)
  ) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return reason;
}

function parseExpectedVersion(record: Record<string, unknown>): number | null {
  if (!Object.prototype.hasOwnProperty.call(record, 'expectedVersion')) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  const value = record['expectedVersion'];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return value;
}

export function parseMerchantInventoryIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new MerchantInventoryIdempotencyKeyRequiredError();
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  const idempotencyKey = value.trim();

  if (idempotencyKey.length === 0) {
    throw new MerchantInventoryIdempotencyKeyRequiredError();
  }

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  return idempotencyKey;
}

export function parseCreateMerchantInventoryAdjustment(
  body: unknown,
  idempotencyHeader: unknown,
): CreateMerchantInventoryAdjustmentInput {
  if (!isRecord(body)) {
    throw new MerchantInventoryAdjustmentValidationError();
  }

  assertNoUnknownKeys(body);

  const action = parseAction(body['action']);

  return {
    variantId: parseVariantId(body['variantId']),
    action,
    quantity: parseQuantity(body['quantity'], action),
    reason: parseReason(body['reason']),
    expectedVersion: parseExpectedVersion(body),
    idempotencyKey: parseMerchantInventoryIdempotencyKey(idempotencyHeader),
  };
}

function parseMovementCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryMovementQueryValidationError();
  }

  const cursor = value.trim();

  if (!POSITIVE_DECIMAL_PATTERN.test(cursor)) {
    throw new MerchantInventoryMovementQueryValidationError();
  }

  return cursor;
}

function parseMovementLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_MOVEMENT_LIMIT;
  }

  const parsed =
    typeof value === 'string' && POSITIVE_DECIMAL_PATTERN.test(value.trim())
      ? Number(value)
      : value;

  if (
    typeof parsed !== 'number' ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_MOVEMENT_LIMIT
  ) {
    throw new MerchantInventoryMovementQueryValidationError();
  }

  return parsed;
}

export function parseMerchantInventoryMovementQuery(
  variantIdValue: unknown,
  cursorValue: unknown,
  limitValue: unknown,
): MerchantInventoryMovementQuery {
  let variantId: string;

  try {
    variantId = parseVariantId(variantIdValue);
  } catch {
    throw new MerchantInventoryMovementQueryValidationError();
  }

  return {
    variantId,
    cursor: parseMovementCursor(cursorValue),
    limit: parseMovementLimit(limitValue),
  };
}
