export const CUSTOMER_GENDER_CATEGORIES = ['WOMEN', 'MEN', 'KIDS', 'UNISEX'] as const;

export type CustomerGenderCategory = (typeof CUSTOMER_GENDER_CATEGORIES)[number];

export interface CustomerProfileIdentity {
  readonly fullName: string | null;
  readonly phoneNumberMasked: string;
}

export interface CustomerPreferenceDraft {
  readonly genderCategories: readonly CustomerGenderCategory[];
  readonly preferredColours: readonly string[];
  readonly preferredSizes: readonly string[];
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
}

export interface CustomerPreferencesPort {
  load(): Promise<CustomerPreferenceDraft>;
  save(draft: CustomerPreferenceDraft): Promise<void>;
}

export function validatePreferenceDraft(draft: CustomerPreferenceDraft): string | null {
  if (draft.minPricePaise !== null && (!Number.isInteger(draft.minPricePaise) || draft.minPricePaise < 0)) {
    return 'Minimum budget must be a non-negative whole amount.';
  }
  if (draft.maxPricePaise !== null && (!Number.isInteger(draft.maxPricePaise) || draft.maxPricePaise < 0)) {
    return 'Maximum budget must be a non-negative whole amount.';
  }
  if (
    draft.minPricePaise !== null &&
    draft.maxPricePaise !== null &&
    draft.minPricePaise > draft.maxPricePaise
  ) {
    return 'Minimum budget cannot be greater than maximum budget.';
  }
  return null;
}

export function parseRupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/u.test(trimmed)) return Number.NaN;
  return Number(trimmed) * 100;
}
