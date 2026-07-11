import { z } from 'zod';

import { commonEnvSchema } from './common.js';
import { validateEnvironment } from './validate.js';

export const webEnvSchema = commonEnvSchema.extend({
  NEXT_PUBLIC_API_BASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(16),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(input: unknown): WebEnv {
  return validateEnvironment(webEnvSchema, input);
}
