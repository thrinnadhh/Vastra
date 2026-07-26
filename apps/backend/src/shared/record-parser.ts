/**
 * Shared record-parsing utilities for gateway response mapping.
 *
 * Every gateway needs to parse unknown Supabase RPC / query responses into
 * typed domain snapshots. These utilities eliminate the need for each gateway
 * to define its own `isRecord`, `requireString`, `requireNumber`, etc.
 *
 * Each function accepts an `Err` constructor so callers preserve their
 * domain-specific error semantics (e.g. `CustomerOrderDataInvalidError`).
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ErrorFactory = new () => Error;

/**
 * Type guard: returns `true` when the value is a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Asserts the value is a record and returns it, or throws `Err`.
 */
export function requireRecord(value: unknown, Err: ErrorFactory): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a non-empty string from a record field, or throws `Err`.
 */
export function requireString(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a string or null from a record field. Throws `Err` on non-string, non-null values.
 */
export function nullableString(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a boolean from a record field, or throws `Err`.
 */
export function requireBoolean(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Err();
  }
  return value;
}

/**
 * Coerces an unknown value to a finite number. Returns `NaN` on failure.
 * Accepts raw numbers and numeric strings.
 */
export function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }
  return Number.NaN;
}

/**
 * Extracts a finite number from a record field, or throws `Err`.
 * Handles both raw numbers and numeric strings (as returned by Supabase for bigint columns).
 */
export function requireNumber(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): number {
  const value = parseNumeric(record[key]);
  if (!Number.isFinite(value)) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a finite number from a record field, or returns null if the value is null/undefined.
 * Throws `Err` on non-numeric, non-null values.
 */
export function nullableNumber(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): number | null {
  const raw = record[key];
  if (raw === null || raw === undefined) {
    return null;
  }
  return requireNumber(record, key, Err);
}

/**
 * Extracts a safe non-negative integer from a record field, or throws `Err`.
 */
export function requireNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): number {
  const value = parseNumeric(record[key]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a safe positive integer (>= 1) from a record field, or throws `Err`.
 */
export function requirePositiveInteger(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): number {
  const value = requireNonNegativeInteger(record, key, Err);
  if (value < 1) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a UUID string from a record field, or throws `Err`.
 */
export function requireUuid(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): string {
  const value = requireString(record, key, Err);
  if (!UUID_PATTERN.test(value)) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a parseable timestamp string from a record field, or throws `Err`.
 */
export function requireTimestamp(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): string {
  const value = requireString(record, key, Err);
  if (Number.isNaN(Date.parse(value))) {
    throw new Err();
  }
  return value;
}

/**
 * Extracts a timestamp string or null from a record field.
 * Returns null for null/undefined. Throws `Err` on invalid timestamps.
 */
export function nullableTimestamp(
  record: Record<string, unknown>,
  key: string,
  Err: ErrorFactory,
): string | null {
  const raw = record[key];
  if (raw === null || raw === undefined) {
    return null;
  }
  return requireTimestamp(record, key, Err);
}
