import { z } from 'zod';

import { commonEnvSchema } from './common.js';
import { validateEnvironment } from './validate.js';

export const mobileEnvSchema = commonEnvSchema.extend({
  EXPO_PUBLIC_API_BASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(16),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

export function parseMobileEnv(input: unknown): MobileEnv {
  return validateEnvironment(mobileEnvSchema, input);
}
