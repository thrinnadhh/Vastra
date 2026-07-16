const DEFAULT_PORT = 8080;
const MINIMUM_PORT = 1;
const MAXIMUM_PORT = 65_535;
const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:3000', 'http://localhost:8081'] as const;

export interface BackendBootstrapConfiguration {
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
}

function resolvePort(value: string | undefined): number {
  const candidate =
    value === undefined || value.trim().length === 0 ? String(DEFAULT_PORT) : value.trim();

  if (!/^\d+$/u.test(candidate)) {
    throw new Error('Invalid environment configuration: PORT');
  }

  const port = Number(candidate);

  if (!Number.isInteger(port) || port < MINIMUM_PORT || port > MAXIMUM_PORT) {
    throw new Error('Invalid environment configuration: PORT');
  }

  return port;
}

function normalizeOrigin(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
  }

  return url.origin;
}

function resolveCorsAllowedOrigins(
  value: string | undefined,
  nodeEnvironment: string | undefined,
): readonly string[] {
  const rawOrigins = value
    ?.split(',')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);

  if (rawOrigins === undefined || rawOrigins.length === 0) {
    if (nodeEnvironment !== 'production') {
      return DEFAULT_DEVELOPMENT_ORIGINS;
    }

    throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
  }

  return [...new Set(rawOrigins.map(normalizeOrigin))];
}

export function loadBackendBootstrapConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): BackendBootstrapConfiguration {
  return {
    port: resolvePort(environment['PORT']),
    corsAllowedOrigins: resolveCorsAllowedOrigins(
      environment['CORS_ALLOWED_ORIGINS'],
      environment['NODE_ENV'],
    ),
  };
}
