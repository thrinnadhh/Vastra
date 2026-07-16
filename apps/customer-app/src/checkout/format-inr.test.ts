import { formatPaiseAsInr } from './format-inr';

describe('formatPaiseAsInr', () => {
  it('formats integer paise with Indian digit grouping', () => {
    expect(formatPaiseAsInr(0)).toBe('₹0.00');
    expect(formatPaiseAsInr(123_456)).toBe('₹1,234.56');
    expect(formatPaiseAsInr(12_34_56_789)).toBe('₹12,34,567.89');
  });

  it('rejects floating-point and negative money inputs', () => {
    expect(() => formatPaiseAsInr(100.5)).toThrow(TypeError);
    expect(() => formatPaiseAsInr(-1)).toThrow(TypeError);
  });
});
