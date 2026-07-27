import { z } from 'zod';

import { commonEnvSchema } from './common.js';
import { validateEnvironment } from './validate.js';

const secretSchema = z.string().min(16);

export const serverEnvSchema = commonEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  HTTP_BODY_LIMIT_KB: z.coerce.number().int().min(16).max(1_024).default(256),
  HTTP_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(10_000).default(240),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),

  DATABASE_URL: z.url(),

  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(16),
  SUPABASE_SERVICE_ROLE_KEY: secretSchema,

  PAYMENT_PROVIDER: z.literal('cashfree'),
  PAYMENT_API_VERSION: z.literal('2025-01-01').default('2025-01-01'),
  PAYMENT_CLIENT_ID: z.string().min(8),
  PAYMENT_SECRET_KEY: secretSchema,
  PAYMENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(10).max(60_000).default(10_000),

  SMS_PROVIDER: z.enum(['msg91', 'twilio']),
  SMS_API_KEY: secretSchema,

  FCM_PROJECT_ID: z.string().min(1),
  FCM_CLIENT_EMAIL: z.email(),
  FCM_PRIVATE_KEY: secretSchema,

  MAPS_API_KEY: secretSchema,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(input: unknown): ServerEnv {
  return validateEnvironment(serverEnvSchema, input);
}
