declare const serverStateBrand: unique symbol;

type Brand<TName extends string> = { readonly [serverStateBrand]: TName };

export type Actor = 'customer' | 'merchant' | 'captain' | 'admin';
export type AccountId = string & Brand<'AccountId'>;
export type LocationScopeId = string & Brand<'LocationScopeId'>;
export type AuthorizationEpoch = string & Brand<'AuthorizationEpoch'>;
export type IdempotencyKey = string & Brand<'IdempotencyKey'>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = Readonly<Record<string, JsonValue>>;
export type NormalizedQueryFilters = JsonObject & Brand<'NormalizedQueryFilters'>;

function nonEmpty<TValue extends string & Brand<string>>(value: string, label: string): TValue {
  if (value.trim().length === 0) throw new TypeError(`${label} must not be empty`);
  return value as TValue;
}

export function asAccountId(value: string): AccountId {
  return nonEmpty<AccountId>(value, 'Account ID');
}

export function asLocationScopeId(value: string): LocationScopeId {
  return nonEmpty<LocationScopeId>(value, 'Location scope ID');
}

export function asAuthorizationEpoch(value: string): AuthorizationEpoch {
  return nonEmpty<AuthorizationEpoch>(value, 'Authorization epoch');
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

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(INVALID_FILTER_MESSAGE);

  const normalized: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeJsonValue((value as Readonly<Record<string, unknown>>)[key]);
  }
  return Object.freeze(normalized);
}

export function normalizeQueryFilters(
  input: Readonly<Record<string, unknown>>,
): NormalizedQueryFilters {
  return normalizeJsonValue(input) as NormalizedQueryFilters;
}
