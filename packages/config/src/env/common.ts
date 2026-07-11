import { z } from 'zod';

import { validateEnvironment } from './validate.js';

export const commonEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
});

export type CommonEnv = z.infer<typeof commonEnvSchema>;

export function parseCommonEnv(input: unknown): CommonEnv {
  return validateEnvironment(commonEnvSchema, input);
}
