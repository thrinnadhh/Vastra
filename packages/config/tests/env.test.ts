import { describe, expect, it } from 'vitest';

import { parseMobileEnv } from '../src/env/mobile.js';
import { parseServerEnv } from '../src/env/server.js';
import { parseWebEnv } from '../src/env/web.js';
import { EnvironmentValidationError } from '../src/env/validate.js';

const commonEnvironment = {
  APP_ENV: 'test',
  LOG_LEVEL: 'info',
} as const;

function captureError(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error: unknown) {
    return error;
  }

  return undefined;
}

describe('environment validation', () => {
  it('accepts a valid mobile environment', () => {
    const result = parseMobileEnv({
      ...commonEnvironment,
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:8080/v1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.invalid',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-publishable-placeholder',
    });

    expect(result.APP_ENV).toBe('test');
  });

  it('accepts a valid web environment', () => {
    const result = parseWebEnv({
      ...commonEnvironment,
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080/v1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-publishable-placeholder',
    });

    expect(result.APP_ENV).toBe('test');
  });

  it('accepts a valid server environment', () => {
    const result = parseServerEnv({
      ...commonEnvironment,
      NODE_ENV: 'test',
      PORT: '8080',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:8081',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_PUBLISHABLE_KEY: 'local-publishable-placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-placeholder',
      PAYMENT_PROVIDER: 'cashfree',
      PAYMENT_SECRET_KEY: 'local-payment-secret-placeholder',
      PAYMENT_WEBHOOK_SECRET: 'local-webhook-secret-placeholder',
      SMS_PROVIDER: 'msg91',
      SMS_API_KEY: 'local-sms-secret-placeholder',
      FCM_PROJECT_ID: 'local-project-placeholder',
      FCM_CLIENT_EMAIL: 'firebase-admin@example.invalid',
      FCM_PRIVATE_KEY: 'local-private-key-placeholder',
      MAPS_API_KEY: 'local-maps-secret-placeholder',
    });

    expect(result.PORT).toBe(8080);
  });

  it('does not return backend secrets from the mobile schema', () => {
    const result = parseMobileEnv({
      ...commonEnvironment,
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:8080/v1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.invalid',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-publishable-placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-returned',
    });

    expect(Object.hasOwn(result, 'SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });

  it('reports variable names without printing secret values', () => {
    const secretValue = 'highly-sensitive-payment-value';

    const error = captureError(() =>
      parseServerEnv({
        ...commonEnvironment,
        NODE_ENV: 'test',
        PORT: '8080',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: 'local-publishable-placeholder',
        SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-placeholder',
        PAYMENT_PROVIDER: 'cashfree',
        PAYMENT_SECRET_KEY: secretValue,
        PAYMENT_WEBHOOK_SECRET: '',
        SMS_PROVIDER: 'msg91',
        SMS_API_KEY: 'local-sms-secret-placeholder',
        FCM_PROJECT_ID: 'local-project-placeholder',
        FCM_CLIENT_EMAIL: 'firebase-admin@example.invalid',
        FCM_PRIVATE_KEY: 'local-private-key-placeholder',
        MAPS_API_KEY: 'local-maps-secret-placeholder',
      }),
    );

    expect(error).toBeInstanceOf(EnvironmentValidationError);

    const message = error instanceof Error ? error.message : String(error);

    expect(message).toContain('PAYMENT_WEBHOOK_SECRET');
    expect(message).not.toContain(secretValue);
  });
});
