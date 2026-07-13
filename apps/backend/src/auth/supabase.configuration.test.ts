import { describe, expect, it } from 'vitest';

import { loadSupabaseConfiguration } from './supabase.configuration';

const validEnvironment: NodeJS.ProcessEnv = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-placeholder',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key-placeholder',
};

function captureError(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error: unknown) {
    return error;
  }

  return undefined;
}

describe('loadSupabaseConfiguration', () => {
  it('loads isolated public and privileged credentials', () => {
    expect(loadSupabaseConfiguration(validEnvironment)).toStrictEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'local-publishable-key-placeholder',
      serviceRoleKey: 'local-service-role-key-placeholder',
    });
  });

  it('rejects a missing publishable key', () => {
    const error = captureError(() =>
      loadSupabaseConfiguration({
        ...validEnvironment,
        SUPABASE_PUBLISHABLE_KEY: undefined,
      }),
    );

    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('SUPABASE_PUBLISHABLE_KEY');
  });

  it('rejects an unsupported URL protocol', () => {
    expect(() =>
      loadSupabaseConfiguration({
        ...validEnvironment,
        SUPABASE_URL: 'file:///tmp/supabase',
      }),
    ).toThrowError('Invalid environment configuration: SUPABASE_URL');
  });

  it('does not include credential values in errors', () => {
    const serviceRoleKey = 'highly-sensitive-service-role-value';
    const error = captureError(() =>
      loadSupabaseConfiguration({
        ...validEnvironment,
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      }),
    );

    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('SUPABASE_URL');
    expect(message).not.toContain(serviceRoleKey);
  });
});
