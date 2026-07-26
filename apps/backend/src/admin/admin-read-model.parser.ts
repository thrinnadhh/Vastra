export class AdminReadModelInvalidError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PHONE_SUFFIX_PATTERN = /^[0-9]{4}$/u;

export function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminReadModelInvalidError();
  }
  return value as Record<string, unknown>;
}

export function requireArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new AdminReadModelInvalidError();
  return value;
}

export function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}

export function requireAllowedString<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = requireString(record, key);
  const matched = allowed.find((candidate) => candidate === value);
  if (matched === undefined) throw new AdminReadModelInvalidError();
  return matched;
}

export function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}

export function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) throw new AdminReadModelInvalidError();
  return value;
}

export function optionalUuid(record: Record<string, unknown>, key: string): string | null {
  const value = optionalString(record, key);
  if (value !== null && !UUID_PATTERN.test(value)) throw new AdminReadModelInvalidError();
  return value;
}

export function optionalPhoneLast4(record: Record<string, unknown>, key: string): string | null {
  const value = optionalString(record, key);
  if (value !== null && !PHONE_SUFFIX_PATTERN.test(value)) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}

export function optionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}

export function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}

export function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNumber(record, key);
  if (!Number.isSafeInteger(value)) throw new AdminReadModelInvalidError();
  return value;
}

export function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new AdminReadModelInvalidError();
  return value;
}

export function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!Number.isFinite(Date.parse(value))) throw new AdminReadModelInvalidError();
  return value;
}

export function optionalTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = optionalString(record, key);
  if (value !== null && !Number.isFinite(Date.parse(value))) {
    throw new AdminReadModelInvalidError();
  }
  return value;
}
