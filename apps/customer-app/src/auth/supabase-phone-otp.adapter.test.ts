import type { CustomerSupabaseClient } from './supabase-session-adapter';
import {
  classifySupabasePhoneOtpError,
  SupabasePhoneOtpAdapter,
} from './supabase-phone-otp.adapter';

function createClient() {
  const signInWithOtp = jest.fn().mockResolvedValue({ data: {}, error: null });
  const verifyOtp = jest.fn().mockResolvedValue({
    data: { session: { access_token: 'token' }, user: { id: 'customer-id' } },
    error: null,
  });

  return {
    client: { auth: { signInWithOtp, verifyOtp } } as unknown as CustomerSupabaseClient,
    signInWithOtp,
    verifyOtp,
  };
}

describe('SupabasePhoneOtpAdapter', () => {
  it('requests and verifies SMS OTP without logging or routing sensitive values', async () => {
    const { client, signInWithOtp, verifyOtp } = createClient();
    const adapter = new SupabasePhoneOtpAdapter(client);

    await adapter.requestOtp('+919876543210');
    await adapter.verifyOtp('+919876543210', '123456');

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { shouldCreateUser: true },
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      token: '123456',
      type: 'sms',
    });
  });

  it('requires Supabase to return an authenticated session after verification', async () => {
    const { client, verifyOtp } = createClient();
    verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: null });

    await expect(
      new SupabasePhoneOtpAdapter(client).verifyOtp('+919876543210', '123456'),
    ).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });
});

describe('classifySupabasePhoneOtpError', () => {
  it.each([
    [{ status: 429, message: 'rate limit' }, 'RATE_LIMIT'],
    [new Error('Token has expired'), 'EXPIRED'],
    [new Error('Invalid OTP token'), 'INVALID_CODE'],
    [new Error('Phone is invalid'), 'INVALID_PHONE'],
    [new Error('network unavailable'), 'UNAVAILABLE'],
  ] as const)('classifies %p as %s', (error, expected) => {
    expect(classifySupabasePhoneOtpError(error)).toBe(expected);
  });
});
