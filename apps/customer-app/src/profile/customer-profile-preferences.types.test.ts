import { parseRupeesToPaise, validatePreferenceDraft } from './customer-profile-preferences.types';

describe('customer profile preferences', () => {
  it('keeps preferences optional', () => {
    expect(validatePreferenceDraft({
      genderCategories: [],
      preferredColours: [],
      preferredSizes: [],
      minPricePaise: null,
      maxPricePaise: null,
    })).toBeNull();
  });

  it('validates budget ordering', () => {
    expect(validatePreferenceDraft({
      genderCategories: [],
      preferredColours: [],
      preferredSizes: [],
      minPricePaise: 200000,
      maxPricePaise: 100000,
    })).toBe('Minimum budget cannot be greater than maximum budget.');
  });

  it('parses whole rupees into integer paise', () => {
    expect(parseRupeesToPaise('1500')).toBe(150000);
    expect(parseRupeesToPaise('')).toBeNull();
    expect(Number.isNaN(parseRupeesToPaise('12.5'))).toBe(true);
  });
});
