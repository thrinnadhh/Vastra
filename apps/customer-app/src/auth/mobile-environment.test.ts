import {
  CustomerMobileEnvironmentError,
  parseCustomerMobileEnvironment,
} from './mobile-environment';

describe('parseCustomerMobileEnvironment', () => {
  it('returns trimmed public mobile configuration', () => {
    expect(
      parseCustomerMobileEnvironment({
        apiBaseUrl: ' https://api.vastra.test/v1/ ',
        supabaseUrl: ' https://vastra.supabase.test/ ',
        supabasePublishableKey: ' publishable-key-value ',
      }),
    ).toStrictEqual({
      apiBaseUrl: 'https://api.vastra.test/v1',
      supabaseUrl: 'https://vastra.supabase.test',
      supabasePublishableKey: 'publishable-key-value',
    });
  });

  it('rejects a non-http API URL', () => {
    expect(() =>
      parseCustomerMobileEnvironment({
        apiBaseUrl: 'file:///tmp/api',
        supabaseUrl: 'https://vastra.supabase.test',
        supabasePublishableKey: 'publishable-key-value',
      }),
    ).toThrow(CustomerMobileEnvironmentError);
  });

  it('rejects a missing publishable key', () => {
    expect(() =>
      parseCustomerMobileEnvironment({
        apiBaseUrl: 'https://api.vastra.test/v1',
        supabaseUrl: 'https://vastra.supabase.test',
        supabasePublishableKey: undefined,
      }),
    ).toThrow('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });
});
