import type { CustomerSupabaseClient } from './supabase-session-adapter';
import { PhoneOtpError, type PhoneOtpErrorKind, type PhoneOtpPort } from './phone-otp.types';

function readErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null;
  }

  return typeof error.status === 'number' ? error.status : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message.toLowerCase() : '';
  }

  return '';
}

export function classifySupabasePhoneOtpError(error: unknown): PhoneOtpErrorKind {
  const status = readErrorStatus(error);
  const message = readErrorMessage(error);

  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return 'RATE_LIMIT';
  }

  if (message.includes('expired')) {
    return 'EXPIRED';
  }

  if (
    message.includes('invalid token') ||
    message.includes('invalid otp') ||
    message.includes('token is invalid')
  ) {
    return 'INVALID_CODE';
  }

  if (message.includes('phone') && message.includes('invalid')) {
    return 'INVALID_PHONE';
  }

  return 'UNAVAILABLE';
}

function throwPhoneOtpError(error: unknown): never {
  throw new PhoneOtpError(classifySupabasePhoneOtpError(error), { cause: error });
}

export class SupabasePhoneOtpAdapter implements PhoneOtpPort {
  public constructor(private readonly client: CustomerSupabaseClient) {}

  public async requestOtp(phoneE164: string): Promise<void> {
    const response = await this.client.auth.signInWithOtp({
      phone: phoneE164,
      options: {
        shouldCreateUser: true,
      },
    });

    if (response.error !== null) {
      throwPhoneOtpError(response.error);
    }
  }

  public async verifyOtp(phoneE164: string, code: string): Promise<void> {
    const response = await this.client.auth.verifyOtp({
      phone: phoneE164,
      token: code,
      type: 'sms',
    });

    if (response.error !== null) {
      throwPhoneOtpError(response.error);
    }

    if (response.data.session === null) {
      throw new PhoneOtpError('UNAVAILABLE');
    }
  }
}
