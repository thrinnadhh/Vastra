export interface MerchantMobileEnvironment {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

export class MerchantMobileEnvironmentError extends Error {
  public constructor(variableName: string) {
    super(`Invalid merchant mobile environment: ${variableName}`);
    this.name = 'MerchantMobileEnvironmentError';
  }
}

function requireUrl(value: string | undefined, variableName: string): string {
  if (value === undefined || value.trim().length === 0)
    throw new MerchantMobileEnvironmentError(variableName);
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new MerchantMobileEnvironmentError(variableName);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new MerchantMobileEnvironmentError(variableName);
  return trimmed.replace(/\/+$/u, '');
}

function requirePublishableKey(value: string | undefined): string {
  if (value === undefined || value.trim().length < 16) {
    throw new MerchantMobileEnvironmentError('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return value.trim();
}

export function parseMerchantMobileEnvironment(input: {
  readonly apiBaseUrl: string | undefined;
  readonly supabaseUrl: string | undefined;
  readonly supabasePublishableKey: string | undefined;
}): MerchantMobileEnvironment {
  return {
    apiBaseUrl: requireUrl(input.apiBaseUrl, 'EXPO_PUBLIC_API_BASE_URL'),
    supabaseUrl: requireUrl(input.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: requirePublishableKey(input.supabasePublishableKey),
  };
}

export function readMerchantMobileEnvironment(): MerchantMobileEnvironment {
  return parseMerchantMobileEnvironment({
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
