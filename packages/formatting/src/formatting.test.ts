import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatPaiseAsInr,
  formatPaiseAsInrCompact,
  formatPriceRange,
} from './formatting.js';

// ---------------------------------------------------------------------------
// formatPaiseAsInr
// ---------------------------------------------------------------------------

describe('formatPaiseAsInr', () => {
  it('formats zero', () => {
    expect(formatPaiseAsInr(0)).toBe('₹0.00');
  });

  it('formats small amounts', () => {
    expect(formatPaiseAsInr(1)).toBe('₹0.01');
    expect(formatPaiseAsInr(99)).toBe('₹0.99');
    expect(formatPaiseAsInr(100)).toBe('₹1.00');
  });

  it('formats amounts without Indian grouping when under 1,000 rupees', () => {
    expect(formatPaiseAsInr(999_00)).toBe('₹999.00');
  });

  it('applies Indian digit grouping', () => {
    expect(formatPaiseAsInr(123_456)).toBe('₹1,234.56');
    expect(formatPaiseAsInr(12_34_56_789)).toBe('₹12,34,567.89');
    expect(formatPaiseAsInr(1_00_00_000)).toBe('₹1,00,000.00');
  });

  it('preserves paise digits', () => {
    expect(formatPaiseAsInr(50_005)).toBe('₹500.05');
    expect(formatPaiseAsInr(10_010)).toBe('₹100.10');
  });

  it('rejects floating-point inputs', () => {
    expect(() => formatPaiseAsInr(100.5)).toThrow(TypeError);
  });

  it('rejects negative inputs', () => {
    expect(() => formatPaiseAsInr(-1)).toThrow(TypeError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => formatPaiseAsInr(NaN)).toThrow(TypeError);
    expect(() => formatPaiseAsInr(Infinity)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// formatPaiseAsInrCompact
// ---------------------------------------------------------------------------

describe('formatPaiseAsInrCompact', () => {
  it('formats zero', () => {
    expect(formatPaiseAsInrCompact(0)).toBe('₹0');
  });

  it('drops decimal places', () => {
    expect(formatPaiseAsInrCompact(50_099)).toBe('₹500');
  });

  it('applies Indian digit grouping', () => {
    expect(formatPaiseAsInrCompact(1_00_00_000)).toBe('₹1,00,000');
    expect(formatPaiseAsInrCompact(12_34_56_700)).toBe('₹12,34,567');
  });

  it('rejects invalid inputs', () => {
    expect(() => formatPaiseAsInrCompact(-1)).toThrow(TypeError);
    expect(() => formatPaiseAsInrCompact(100.5)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// formatDistance
// ---------------------------------------------------------------------------

describe('formatDistance', () => {
  it('returns metres with suffix for distances under 1km', () => {
    expect(formatDistance(350)).toBe('350 m away');
    expect(formatDistance(0)).toBe('0 m away');
    expect(formatDistance(999)).toBe('999 m away');
  });

  it('returns kilometres with suffix for distances at or above 1km', () => {
    expect(formatDistance(1000)).toBe('1.0 km away');
    expect(formatDistance(2300)).toBe('2.3 km away');
    expect(formatDistance(15_750)).toBe('15.8 km away');
  });

  it('omits suffix when suffix: false', () => {
    expect(formatDistance(350, { suffix: false })).toBe('350 m');
    expect(formatDistance(2300, { suffix: false })).toBe('2.3 km');
  });

  it('handles null as "Distance pending"', () => {
    expect(formatDistance(null)).toBe('Distance pending');
  });

  it('rounds metres to nearest integer', () => {
    expect(formatDistance(350.7)).toBe('351 m away');
    expect(formatDistance(350.3)).toBe('350 m away');
  });
});

// ---------------------------------------------------------------------------
// formatPriceRange
// ---------------------------------------------------------------------------

describe('formatPriceRange', () => {
  it('returns "Price unavailable" for null min', () => {
    expect(formatPriceRange(null, null)).toBe('Price unavailable');
    expect(formatPriceRange(null, 50_000)).toBe('Price unavailable');
  });

  it('returns single price when min equals max', () => {
    expect(formatPriceRange(50_000, 50_000)).toBe('₹500');
  });

  it('returns single price when max is null', () => {
    expect(formatPriceRange(50_000, null)).toBe('₹500');
  });

  it('returns range when min and max differ', () => {
    expect(formatPriceRange(50_000, 100_000)).toBe('₹500–₹1,000');
  });

  it('uses compact formatting (no decimals)', () => {
    expect(formatPriceRange(50_050, 100_099)).toBe('₹500–₹1,000');
  });
});
