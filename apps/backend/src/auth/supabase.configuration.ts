export const SUPABASE_CONFIGURATION = Symbol('SUPABASE_CONFIGURATION');

export interface SupabaseConfiguration {
  readonly url: string;
  readonly publishableKey: string;
  readonly serviceRoleKey: string;
}

function requireEnvironmentValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }

  return value;
}

function requireHttpUrl(value: string, name: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid environment configuration: ${name}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid environment configuration: ${name}`);
  }

  return parsed.toString().replace(/\/$/u, '');
}

function requireKey(environment: NodeJS.ProcessEnv, name: string): string {
  const value = requireEnvironmentValue(environment, name);

  if (value.length < 16) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }

  return value;
}

export function loadSupabaseConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseConfiguration {
  return {
    url: requireHttpUrl(requireEnvironmentValue(environment, 'SUPABASE_URL'), 'SUPABASE_URL'),
    publishableKey: requireKey(environment, 'SUPABASE_PUBLISHABLE_KEY'),
    serviceRoleKey: requireKey(environment, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}
