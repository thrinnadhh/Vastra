import {
  mergeSupportedPreferenceDraft,
  parseCommaSeparatedSizes,
  parseRupeesToPaise,
  validatePreferenceDraft,
  type CustomerPreferenceSnapshot,
} from './customer-profile-preferences.types';

const existing: CustomerPreferenceSnapshot = {
  genderCategories: ['WOMEN'],
  styleTags: ['casual'],
  occasionTags: ['work'],
  preferredColours: ['#112233'],
  preferredSizes: ['M'],
  minPricePaise: 50_000,
  maxPricePaise: 200_000,
  updatedAt: null,
};

describe('customer profile preferences', () => {
  it('keeps all supported preferences optional', () => {
    expect(
      validatePreferenceDraft({
        genderCategories: [],
        preferredSizes: [],
        minPricePaise: null,
        maxPricePaise: null,
      }),
    ).toBeNull();
  });

  it('validates budget ordering', () => {
    expect(
      validatePreferenceDraft({
        genderCategories: [],
        preferredSizes: [],
        minPricePaise: 200_000,
        maxPricePaise: 100_000,
      }),
    ).toBe('Minimum budget cannot be greater than maximum budget.');
  });

  it('parses decimal rupees into integer paise without accepting malformed money', () => {
    expect(parseRupeesToPaise('1500.25')).toBe(150_025);
    expect(parseRupeesToPaise('')).toBeNull();
    expect(parseRupeesToPaise('12.345')).toBeUndefined();
  });

  it('normalizes and deduplicates comma-separated sizes', () => {
    expect(parseCommaSeparatedSizes('m, L, m')).toEqual(['M', 'L']);
  });

  it('preserves supported preference fields that are not edited by onboarding', () => {
    expect(
      mergeSupportedPreferenceDraft(
        {
          genderCategories: ['MEN'],
          preferredSizes: ['L'],
          minPricePaise: null,
          maxPricePaise: 300_000,
        },
        existing,
      ),
    ).toEqual({
      genderCategories: ['MEN'],
      preferredSizes: ['L'],
      minPricePaise: null,
      maxPricePaise: 300_000,
      styleTags: ['casual'],
      occasionTags: ['work'],
      preferredColours: ['#112233'],
    });
  });
});
