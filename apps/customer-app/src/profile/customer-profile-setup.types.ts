export type CustomerProfileSetupResult =
  | { readonly kind: 'SAVED'; readonly fullName: string }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'UNAVAILABLE' };

export interface CustomerProfileSetupPort {
  save(fullName: string): Promise<CustomerProfileSetupResult>;
}

export function normalizeCustomerFullName(value: string): string | null {
  const normalized = value.trim().replaceAll(/\s+/gu, ' ');
  if (normalized.length < 2 || normalized.length > 120) {
    return null;
  }

  return normalized;
}
