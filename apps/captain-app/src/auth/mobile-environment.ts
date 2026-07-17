export interface CaptainMobileEnvironment {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

interface RawCaptainMobileEnvironment {
  readonly apiBaseUrl: string | undefined;
  readonly supabaseUrl: string | undefined;
  readonly supabasePublishableKey: string | undefined;
}

export class CaptainMobileEnvironmentError extends Error {
  public constructor(variableName: string) {
    super(`Invalid captain mobile environment: ${variableName}`);
    this.name = 'CaptainMobileEnvironmentError';
  }
}

function requireUrl(value: string | undefined, variableName: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new CaptainMobileEnvironmentError(variableName);
  }

  const trimmed = value.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new CaptainMobileEnvironmentError(variableName);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CaptainMobileEnvironmentError(variableName);
  }

  return trimmed.replace(/\/+$/u, '');
}

function requirePublishableKey(value: string | undefined): string {
  if (value === undefined || value.trim().length < 16) {
    throw new CaptainMobileEnvironmentError('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return value.trim();
}

export function parseCaptainMobileEnvironment(
  input: RawCaptainMobileEnvironment,
): CaptainMobileEnvironment {
  return {
    apiBaseUrl: requireUrl(input.apiBaseUrl, 'EXPO_PUBLIC_API_BASE_URL'),
    supabaseUrl: requireUrl(input.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: requirePublishableKey(input.supabasePublishableKey),
  };
}

function readProcessEnvironmentValue(key: string): string | undefined {
  const environment: unknown = process.env;

  if (typeof environment !== 'object' || environment === null) {
    return undefined;
  }

  const value = (environment as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function readCaptainMobileEnvironment(): CaptainMobileEnvironment {
  return parseCaptainMobileEnvironment({
    apiBaseUrl: readProcessEnvironmentValue('EXPO_PUBLIC_API_BASE_URL'),
    supabaseUrl: readProcessEnvironmentValue('EXPO_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: readProcessEnvironmentValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  });
}
