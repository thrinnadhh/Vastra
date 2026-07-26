import { Buffer } from 'node:buffer';

export interface AdminListCursor {
  readonly updatedAt: string;
  readonly id: string;
}

export class AdminListQueryInvalidError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseAdminListCursor(value: unknown): AdminListCursor | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 512) {
    throw new AdminListQueryInvalidError();
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
      throw new AdminListQueryInvalidError();
    }
    const record = decoded as Record<string, unknown>;
    const updatedAt = record['updatedAt'];
    const id = record['id'];
    if (
      typeof updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(updatedAt)) ||
      typeof id !== 'string' ||
      !UUID_PATTERN.test(id)
    ) {
      throw new AdminListQueryInvalidError();
    }
    return { updatedAt, id };
  } catch (error: unknown) {
    if (error instanceof AdminListQueryInvalidError) throw error;
    throw new AdminListQueryInvalidError();
  }
}

export function encodeAdminListCursor(cursor: AdminListCursor | null): string | null {
  if (cursor === null) return null;
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function parseAdminListLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') return 25;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new AdminListQueryInvalidError();
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new AdminListQueryInvalidError();
  }
  return limit;
}

export function parseAdminOptionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminListQueryInvalidError();
  }
  return value.trim();
}

export function parseAdminOptionalSearch(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminListQueryInvalidError();
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 120) {
    throw new AdminListQueryInvalidError();
  }
  return normalized;
}

export function parseAdminOptionalEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminListQueryInvalidError();
  const matched = allowed.find((candidate) => candidate === value);
  if (matched === undefined) throw new AdminListQueryInvalidError();
  return matched;
}
