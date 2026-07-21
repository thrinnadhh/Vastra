export const CUSTOMER_GENDER_CATEGORIES = ['WOMEN', 'MEN', 'KIDS', 'UNISEX'] as const;

export type CustomerGenderCategory = (typeof CUSTOMER_GENDER_CATEGORIES)[number];

export interface CustomerProfileIdentity {
  readonly fullName: string | null;
}

export interface CustomerPreferenceSnapshot {
  readonly genderCategories: readonly CustomerGenderCategory[];
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly preferredColours: readonly string[];
  readonly preferredSizes: readonly string[];
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
  readonly updatedAt: string | null;
}

export interface CustomerPreferenceDraft {
  readonly genderCategories: readonly CustomerGenderCategory[];
  readonly preferredSizes: readonly string[];
  readonly minPricePaise: number | null;
  readonly maxPricePaise: number | null;
}

export interface ReplaceCustomerPreferencesInput extends CustomerPreferenceDraft {
  readonly styleTags: readonly string[];
  readonly occasionTags: readonly string[];
  readonly preferredColours: readonly string[];
}

export type CustomerPreferencesLoadResult =
  | { readonly kind: 'READY'; readonly preferences: CustomerPreferenceSnapshot }
  | { readonly kind: 'UNAVAILABLE' };

export type CustomerPreferencesSaveResult =
  | { readonly kind: 'SAVED'; readonly preferences: CustomerPreferenceSnapshot }
  | { readonly kind: 'UNAVAILABLE' };

export interface CustomerPreferencesPort {
  load(): Promise<CustomerPreferencesLoadResult>;
  save(input: ReplaceCustomerPreferencesInput): Promise<CustomerPreferencesSaveResult>;
}

export function validatePreferenceDraft(draft: CustomerPreferenceDraft): string | null {
  if (
    draft.minPricePaise !== null &&
    (!Number.isSafeInteger(draft.minPricePaise) || draft.minPricePaise < 0)
  ) {
    return 'Minimum budget must be a non-negative amount.';
  }

  if (
    draft.maxPricePaise !== null &&
    (!Number.isSafeInteger(draft.maxPricePaise) || draft.maxPricePaise < 0)
  ) {
    return 'Maximum budget must be a non-negative amount.';
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

export function parseRupeesToPaise(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/u.test(trimmed)) {
    return undefined;
  }

  const paise = Math.round(Number(trimmed) * 100);
  return Number.isSafeInteger(paise) && paise >= 0 ? paise : undefined;
}

export function parseCommaSeparatedSizes(value: string): readonly string[] {
  const normalized = value
    .split(',')
    .map((item) => item.trim().toLocaleUpperCase('en-IN'))
    .filter((item) => item.length > 0);

  return [...new Set(normalized)];
}

export function mergeSupportedPreferenceDraft(
  draft: CustomerPreferenceDraft,
  existing: CustomerPreferenceSnapshot,
): ReplaceCustomerPreferencesInput {
  return {
    genderCategories: draft.genderCategories,
    preferredSizes: draft.preferredSizes,
    minPricePaise: draft.minPricePaise,
    maxPricePaise: draft.maxPricePaise,
    styleTags: existing.styleTags,
    occasionTags: existing.occasionTags,
    preferredColours: existing.preferredColours,
  };
}
