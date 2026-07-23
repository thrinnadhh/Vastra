import type {
  CustomerAddressDraft,
  CustomerAddressFieldErrors,
  SaveCustomerAddressInput,
} from './customer-address.types';

const PHONE_PATTERN = /^\+?[1-9][0-9]{7,14}$/u;
const POSTAL_PATTERN = /^[0-9]{6}$/u;

const trimmedNullable = (value: string): string | null => {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

export interface CustomerAddressValidationResult {
  readonly input: SaveCustomerAddressInput | null;
  readonly fieldErrors: CustomerAddressFieldErrors;
}

export function validateCustomerAddressDraft(
  draft: CustomerAddressDraft,
): CustomerAddressValidationResult {
  const errors: Record<string, string> = {};
  const required = (
    field: keyof CustomerAddressDraft,
    value: string,
    label: string,
    maxLength: number,
  ): string => {
    const normalized = value.trim();
    if (normalized.length === 0) errors[field] = `${label} is required.`;
    else if (normalized.length > maxLength) errors[field] = `${label} is too long.`;
    return normalized;
  };

  const recipientName = required('recipientName', draft.recipientName, 'Recipient name', 120);
  const phoneNumber = required('phoneNumber', draft.phoneNumber, 'Phone number', 16);
  const line1 = required('line1', draft.line1, 'Address line 1', 250);
  const area = required('area', draft.area, 'Area', 120);
  const city = required('city', draft.city, 'City', 120);
  const state = required('state', draft.state, 'State', 120);
  const postalCode = required('postalCode', draft.postalCode, 'Postal code', 6);
  const latitude = Number(draft.latitude.trim());
  const longitude = Number(draft.longitude.trim());

  if (phoneNumber.length > 0 && !PHONE_PATTERN.test(phoneNumber)) {
    errors['phoneNumber'] = 'Enter a valid phone number with 8 to 15 digits.';
  }
  if (postalCode.length > 0 && !POSTAL_PATTERN.test(postalCode)) {
    errors['postalCode'] = 'Enter a valid 6-digit postal code.';
  }
  if (draft.label.trim().length > 80) errors['label'] = 'Label is too long.';
  if (draft.line2.trim().length > 250) errors['line2'] = 'Address line 2 is too long.';
  if (draft.landmark.trim().length > 180) errors['landmark'] = 'Landmark is too long.';
  if (
    draft.latitude.trim().length === 0 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    errors['latitude'] = 'Enter a latitude between -90 and 90.';
  }
  if (
    draft.longitude.trim().length === 0 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    errors['longitude'] = 'Enter a longitude between -180 and 180.';
  }

  if (Object.keys(errors).length > 0) {
    return { input: null, fieldErrors: errors };
  }

  return {
    input: {
      label: trimmedNullable(draft.label),
      recipientName,
      phoneNumber,
      line1,
      line2: trimmedNullable(draft.line2),
      landmark: trimmedNullable(draft.landmark),
      area,
      city,
      state,
      postalCode,
      countryCode: 'IN',
      latitude,
      longitude,
      isDefault: draft.isDefault,
    },
    fieldErrors: {},
  };
}
