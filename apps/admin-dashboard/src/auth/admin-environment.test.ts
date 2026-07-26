import { describe, expect, it } from 'vitest';

import { AdminEnvironmentError, readAdminEnvironment } from './admin-environment';

describe('readAdminEnvironment', () => {
  it('accepts public admin configuration and removes trailing API slashes', () => {
    expect(
      readAdminEnvironment({
        NEXT_PUBLIC_API_BASE_URL: 'https://api.vastra.example/v1/',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.vastra.example/v1',
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key',
    });
  });

  it.each([
    {},
    {
      NEXT_PUBLIC_API_BASE_URL: 'javascript:alert(1)',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    },
    {
      NEXT_PUBLIC_API_BASE_URL: 'https://api.vastra.example/v1',
      NEXT_PUBLIC_SUPABASE_URL: 'http://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    },
    {
      NEXT_PUBLIC_API_BASE_URL: 'https://api.vastra.example/v1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_must-never-enter-a-client',
    },
    {
      NEXT_PUBLIC_API_BASE_URL: 'https://api.vastra.example/v1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test-signature',
    },
  ])('fails closed for missing or unsafe public configuration', (environment) => {
    expect(() => readAdminEnvironment(environment)).toThrow(AdminEnvironmentError);
  });
});
