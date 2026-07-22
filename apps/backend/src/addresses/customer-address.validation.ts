import type {
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from './customer-address.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE = /^\+?[1-9][0-9]{7,14}$/;
const POSTAL = /^[0-9]{6}$/;
const ALLOWED = new Set([
  'label',
  'recipientName',
  'phoneNumber',
  'line1',
  'line2',
  'landmark',
  'area',
  'city',
  'state',
  'postalCode',
  'countryCode',
  'latitude',
  'longitude',
  'isDefault',
]);

export class CustomerAddressValidationError extends Error {
  public constructor() {
    super('Invalid customer address request');
    this.name = 'CustomerAddressValidationError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CustomerAddressValidationError();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new CustomerAddressValidationError();
  const result = value.trim();
  if (result.length === 0 || result.length > max) throw new CustomerAddressValidationError();
  return result;
}
function nullableText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  return text(value, max);
}
function coordinate(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new CustomerAddressValidationError();
  return value;
}
function rejectUnknown(value: Record<string, unknown>): void {
  if (Object.keys(value).some((key) => !ALLOWED.has(key)))
    throw new CustomerAddressValidationError();
}

export function parseCustomerAddressId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new CustomerAddressValidationError();
  return value;
}
export function parseAddressIdempotencyKey(value: unknown): string {
  return parseCustomerAddressId(value);
}
export function parseCreateCustomerAddress(value: unknown): CreateCustomerAddressInput {
  const input = record(value);
  rejectUnknown(input);
  const phoneNumber = text(input['phoneNumber'], 16);
  const postalCode = text(input['postalCode'], 6);
  if (!PHONE.test(phoneNumber) || !POSTAL.test(postalCode) || input['countryCode'] !== 'IN')
    throw new CustomerAddressValidationError();
  return {
    label: nullableText(input['label'], 80),
    recipientName: text(input['recipientName'], 120),
    phoneNumber,
    line1: text(input['line1'], 250),
    line2: nullableText(input['line2'], 250),
    landmark: nullableText(input['landmark'], 180),
    area: text(input['area'], 120),
    city: text(input['city'], 120),
    state: text(input['state'], 120),
    postalCode,
    countryCode: 'IN',
    latitude: coordinate(input['latitude'], -90, 90),
    longitude: coordinate(input['longitude'], -180, 180),
    isDefault: input['isDefault'] === true,
  };
}
export function parseUpdateCustomerAddress(value: unknown): UpdateCustomerAddressInput {
  const input = record(value);
  rejectUnknown(input);
  if (Object.keys(input).length === 0) throw new CustomerAddressValidationError();
  const result: Record<string, unknown> = {};
  if ('label' in input) result['label'] = nullableText(input['label'], 80);
  if ('recipientName' in input) result['recipientName'] = text(input['recipientName'], 120);
  if ('phoneNumber' in input) {
    const phone = text(input['phoneNumber'], 16);
    if (!PHONE.test(phone)) throw new CustomerAddressValidationError();
    result['phoneNumber'] = phone;
  }
  if ('line1' in input) result['line1'] = text(input['line1'], 250);
  if ('line2' in input) result['line2'] = nullableText(input['line2'], 250);
  if ('landmark' in input) result['landmark'] = nullableText(input['landmark'], 180);
  if ('area' in input) result['area'] = text(input['area'], 120);
  if ('city' in input) result['city'] = text(input['city'], 120);
  if ('state' in input) result['state'] = text(input['state'], 120);
  if ('postalCode' in input) {
    const postal = text(input['postalCode'], 6);
    if (!POSTAL.test(postal)) throw new CustomerAddressValidationError();
    result['postalCode'] = postal;
  }
  if ('countryCode' in input) {
    if (input['countryCode'] !== 'IN') throw new CustomerAddressValidationError();
    result['countryCode'] = 'IN';
  }
  if ('latitude' in input) result['latitude'] = coordinate(input['latitude'], -90, 90);
  if ('longitude' in input) result['longitude'] = coordinate(input['longitude'], -180, 180);
  if ('isDefault' in input) {
    if (typeof input['isDefault'] !== 'boolean') throw new CustomerAddressValidationError();
    result['isDefault'] = input['isDefault'];
  }
  return result;
}
