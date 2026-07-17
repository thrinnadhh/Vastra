import {
  MerchantMobileEnvironmentError,
  parseMerchantMobileEnvironment,
} from './merchant-environment';

describe('merchant mobile environment', () => {
  it('normalizes public endpoints', () => {
    expect(
      parseMerchantMobileEnvironment({
        apiBaseUrl: 'https://api.example.test/',
        supabaseUrl: 'https://project.supabase.co/',
        supabasePublishableKey: 'publishable-key-long-enough',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test',
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key-long-enough',
    });
  });

  it('rejects missing or secret-like unusable configuration', () => {
    expect(() =>
      parseMerchantMobileEnvironment({
        apiBaseUrl: undefined,
        supabaseUrl: 'https://project.supabase.co',
        supabasePublishableKey: 'publishable-key-long-enough',
      }),
    ).toThrow(MerchantMobileEnvironmentError);
    expect(() =>
      parseMerchantMobileEnvironment({
        apiBaseUrl: 'file:///tmp/api',
        supabaseUrl: 'https://project.supabase.co',
        supabasePublishableKey: 'short',
      }),
    ).toThrow(MerchantMobileEnvironmentError);
  });
});
