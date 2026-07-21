import {
  getOtpResendRemainingSeconds,
  isValidOtpCode,
  normalizeIndianPhone,
  phoneOtpErrorMessage,
} from './phone-otp.types';

describe('phone OTP contract', () => {
  it('normalizes supported Indian mobile-number forms', () => {
    expect(normalizeIndianPhone('98765 43210')).toBe('+919876543210');
    expect(normalizeIndianPhone('+91-98765-43210')).toBe('+919876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('+919876543210');
  });

  it('rejects incomplete and non-mobile values', () => {
    expect(normalizeIndianPhone('12345')).toBeNull();
    expect(normalizeIndianPhone('5123456789')).toBeNull();
  });

  it('requires exactly six numeric OTP digits', () => {
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('12345a')).toBe(false);
  });

  it('bounds resend timing at zero seconds', () => {
    expect(getOtpResendRemainingSeconds(31_000, 1_000)).toBe(30);
    expect(getOtpResendRemainingSeconds(31_000, 31_001)).toBe(0);
  });

  it('provides truthful recovery messages for every error kind', () => {
    expect(phoneOtpErrorMessage('EXPIRED')).toContain('expired');
    expect(phoneOtpErrorMessage('RATE_LIMIT')).toContain('Too many');
    expect(phoneOtpErrorMessage('UNAVAILABLE')).toContain('connection');
  });
});
