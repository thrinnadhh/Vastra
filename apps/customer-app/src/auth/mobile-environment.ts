export interface CustomerMobileEnvironment {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

interface RawCustomerMobileEnvironment {
  readonly apiBaseUrl: string | undefined;
  readonly supabaseUrl: string | undefined;
  readonly supabasePublishableKey: string | undefined;
}

export class CustomerMobileEnvironmentError extends Error {
  public constructor(variableName: string) {
    super(`Invalid customer mobile environment: ${variableName}`);
    this.name = 'CustomerMobileEnvironmentError';
  }
}

function requireUrl(value: string | undefined, variableName: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new CustomerMobileEnvironmentError(variableName);
  }

  const trimmed = value.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new CustomerMobileEnvironmentError(variableName);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CustomerMobileEnvironmentError(variableName);
  }

  return trimmed.replace(/\/+$/u, '');
}

function requirePublishableKey(value: string | undefined): string {
  if (value === undefined || value.trim().length < 16) {
    throw new CustomerMobileEnvironmentError('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return value.trim();
}

export function parseCustomerMobileEnvironment(
  input: RawCustomerMobileEnvironment,
): CustomerMobileEnvironment {
  return {
    apiBaseUrl: requireUrl(input.apiBaseUrl, 'EXPO_PUBLIC_API_BASE_URL'),
    supabaseUrl: requireUrl(input.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: requirePublishableKey(input.supabasePublishableKey),
  };
}

export function readCustomerMobileEnvironment(): CustomerMobileEnvironment {
  return parseCustomerMobileEnvironment({
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
