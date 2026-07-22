import type { UpdateCustomerProfileInput } from './customer-profile.types';

const ALLOWED_KEYS = new Set(['fullName']);
const MIN_FULL_NAME_LENGTH = 2;
const MAX_FULL_NAME_LENGTH = 120;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

export class CustomerProfileValidationError extends Error {
  public constructor() {
    super('Customer profile request is invalid');
    this.name = 'CustomerProfileValidationError';
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerProfileValidationError();
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new CustomerProfileValidationError();
  }

  return record;
}

export function parseUpdateCustomerProfileInput(value: unknown): UpdateCustomerProfileInput {
  const record = requireRecord(value);
  const fullName = record['fullName'];

  if (typeof fullName !== 'string') {
    throw new CustomerProfileValidationError();
  }

  const normalizedFullName = fullName.trim().replaceAll(/\s+/gu, ' ');
  if (
    normalizedFullName.length < MIN_FULL_NAME_LENGTH ||
    normalizedFullName.length > MAX_FULL_NAME_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalizedFullName)
  ) {
    throw new CustomerProfileValidationError();
  }

  return { fullName: normalizedFullName };
}
