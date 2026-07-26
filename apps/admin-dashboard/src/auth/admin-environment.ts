export interface AdminEnvironment {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

export class AdminEnvironmentError extends Error {
  public constructor() {
    super('Admin public environment is unavailable');
    this.name = 'AdminEnvironmentError';
  }
}

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

function isPrivilegedSupabaseKey(value: string): boolean {
  if (value.toLowerCase().startsWith('sb_secret_')) return true;
  const payload = value.split('.')[1];
  if (payload === undefined) return false;
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims: unknown = JSON.parse(globalThis.atob(padded));
    return (
      typeof claims === 'object' &&
      claims !== null &&
      !Array.isArray(claims) &&
      (claims as Readonly<Record<string, unknown>>)['role'] === 'service_role'
    );
  } catch {
    return false;
  }
}

function parseUrl(rawValue: string | undefined, kind: 'API' | 'SUPABASE'): string {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    throw new AdminEnvironmentError();
  }

  let value: URL;
  try {
    value = new URL(rawValue.trim());
  } catch {
    throw new AdminEnvironmentError();
  }

  const localApiHost =
    kind === 'API' &&
    value.protocol === 'http:' &&
    (value.hostname === 'localhost' || value.hostname === '127.0.0.1');
  if (
    (value.protocol !== 'https:' && !localApiHost) ||
    value.username.length > 0 ||
    value.password.length > 0 ||
    value.search.length > 0 ||
    value.hash.length > 0
  ) {
    throw new AdminEnvironmentError();
  }

  return value.toString().replace(/\/+$/u, '');
}

export function readAdminEnvironment(
  environment: PublicEnvironment = process.env,
): AdminEnvironment {
  const publishableKey = environment['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']?.trim();
  if (
    publishableKey === undefined ||
    publishableKey.length < 8 ||
    isPrivilegedSupabaseKey(publishableKey)
  ) {
    throw new AdminEnvironmentError();
  }

  return {
    apiBaseUrl: parseUrl(environment['NEXT_PUBLIC_API_BASE_URL'], 'API'),
    supabaseUrl: parseUrl(environment['NEXT_PUBLIC_SUPABASE_URL'], 'SUPABASE'),
    supabasePublishableKey: publishableKey,
  };
}
