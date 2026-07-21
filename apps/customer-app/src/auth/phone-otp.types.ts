export type PhoneOtpErrorKind =
  'INVALID_PHONE' | 'INVALID_CODE' | 'EXPIRED' | 'RATE_LIMIT' | 'UNAVAILABLE';

export class PhoneOtpError extends Error {
  public constructor(
    public readonly kind: PhoneOtpErrorKind,
    options?: { readonly cause?: unknown },
  ) {
    super(kind, options);
    this.name = 'PhoneOtpError';
  }
}

export interface PhoneOtpPort {
  requestOtp(phoneE164: string): Promise<void>;
  verifyOtp(phoneE164: string, code: string): Promise<void>;
}

export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replaceAll(/\D/gu, '');

  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  return /^[6-9][0-9]{9}$/u.test(digits) ? `+91${digits}` : null;
}

export function isValidOtpCode(value: string): boolean {
  return /^[0-9]{6}$/u.test(value);
}

export function getOtpResendRemainingSeconds(cooldownUntilMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((cooldownUntilMs - nowMs) / 1000));
}

export function phoneOtpErrorMessage(kind: PhoneOtpErrorKind): string {
  switch (kind) {
    case 'INVALID_PHONE':
      return 'Enter a valid 10-digit Indian mobile number.';
    case 'INVALID_CODE':
      return 'Enter the correct 6-digit code.';
    case 'EXPIRED':
      return 'That code has expired. Request a new code and try again.';
    case 'RATE_LIMIT':
      return 'Too many attempts. Wait before requesting or verifying another code.';
    case 'UNAVAILABLE':
      return 'We could not complete phone sign-in. Check your connection and try again.';
  }
}
