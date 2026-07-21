declare const serverStateBrand: unique symbol;

interface Brand<TName extends string> {
  readonly [serverStateBrand]: TName;
}

export type Actor = 'customer' | 'merchant' | 'captain' | 'admin';
export type AccountId = string & Brand<'AccountId'>;
export type LocationScopeId = string & Brand<'LocationScopeId'>;
export type AuthorizationEpoch = string & Brand<'AuthorizationEpoch'>;
export type IdempotencyKey = string & Brand<'IdempotencyKey'>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = readonly JsonValue[];
export type NormalizedQueryFilters = JsonObject & Brand<'NormalizedQueryFilters'>;

function nonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) throw new TypeError(`${label} must not be empty`);
  return value;
}

export function asAccountId(value: string): AccountId {
  return nonEmpty(value, 'Account ID') as AccountId;
}

export function asLocationScopeId(value: string): LocationScopeId {
  return nonEmpty(value, 'Location scope ID') as LocationScopeId;
}

export function asAuthorizationEpoch(value: string): AuthorizationEpoch {
  return nonEmpty(value, 'Authorization epoch') as AuthorizationEpoch;
}

const INVALID_FILTER_MESSAGE = 'Query filters must contain only finite JSON values';

function normalizeJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(INVALID_FILTER_MESSAGE);
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => normalizeJsonValue(item)));
  if (typeof value !== 'object') throw new TypeError(INVALID_FILTER_MESSAGE);

  if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw new TypeError(INVALID_FILTER_MESSAGE);
  }

  const source = value as Readonly<Record<string, unknown>>;
  const normalized: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeJsonValue(source[key]);
  }
  return Object.freeze(normalized);
}

export function normalizeQueryFilters(
  input: Readonly<Record<string, unknown>>,
): NormalizedQueryFilters {
  const normalized = normalizeJsonValue(input);
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new TypeError(INVALID_FILTER_MESSAGE);
  }
  return normalized as NormalizedQueryFilters;
}
