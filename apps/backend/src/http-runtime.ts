import { randomUUID } from 'node:crypto';

export interface HttpRuntimeConfiguration {
  readonly allowedOrigins: readonly string[];
  readonly bodyLimit: string;
  readonly rateLimitMax: number;
  readonly trustProxyHops: number;
  readonly production: boolean;
}

interface HttpRequest {
  readonly headers: Record<string, string | readonly string[] | undefined>;
  readonly ip?: string;
  readonly method?: string;
  readonly socket?: { readonly remoteAddress?: string };
}

interface HttpResponse {
  statusCode: number;
  end(body?: string): void;
  setHeader(name: string, value: string | number): void;
}

type NextFunction = () => void;

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:19006',
] as const;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAXIMUM_RATE_LIMIT_KEYS = 10_000;

function parseInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }
  return value;
}

function parseAllowedOrigins(
  environment: NodeJS.ProcessEnv,
  production: boolean,
): readonly string[] {
  const raw = environment['CORS_ALLOWED_ORIGINS']?.trim();
  if (raw === undefined || raw.length === 0) {
    if (production) throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
    return DEVELOPMENT_ORIGINS;
  }

  const origins = raw.split(',').map((value) => value.trim());
  if (origins.some((value) => value.length === 0 || value === '*')) {
    throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
  }

  const normalized = origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.pathname !== '/' ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0 ||
      (production && parsed.protocol !== 'https:')
    ) {
      throw new Error('Invalid environment configuration: CORS_ALLOWED_ORIGINS');
    }
    return parsed.origin;
  });

  return [...new Set(normalized)];
}

export function loadHttpRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): HttpRuntimeConfiguration {
  const production = environment['NODE_ENV'] === 'production';
  const bodyLimitKilobytes = parseInteger(environment, 'HTTP_BODY_LIMIT_KB', 256, 16, 1_024);

  return {
    allowedOrigins: parseAllowedOrigins(environment, production),
    bodyLimit: `${String(bodyLimitKilobytes)}kb`,
    rateLimitMax: parseInteger(environment, 'HTTP_RATE_LIMIT_MAX', 240, 10, 10_000),
    trustProxyHops: parseInteger(environment, 'TRUST_PROXY_HOPS', 0, 0, 3),
    production,
  };
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

export function createSecurityHeadersMiddleware(production: boolean) {
  return (_request: HttpRequest, response: HttpResponse, next: NextFunction): void => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    if (production) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

export function createRequestIdMiddleware() {
  return (request: HttpRequest, response: HttpResponse, next: NextFunction): void => {
    const supplied = request.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    next();
  };
}

export function createJsonContentTypeMiddleware() {
  return (request: HttpRequest, response: HttpResponse, next: NextFunction): void => {
    const method = request.method?.toUpperCase();
    const requiresJson = method === 'POST' || method === 'PUT' || method === 'PATCH';
    const hasBody =
      request.headers['transfer-encoding'] !== undefined ||
      (Number(request.headers['content-length'] ?? 0) > 0 &&
        Number.isFinite(Number(request.headers['content-length'])));
    const contentType = request.headers['content-type'];
    const isJson =
      typeof contentType === 'string' && /^application\/json(?:\s*;|$)/iu.test(contentType);

    if (requiresJson && hasBody && !isJson) {
      response.statusCode = 415;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          statusCode: 415,
          message: 'Content-Type must be application/json',
          error: 'Unsupported Media Type',
        }),
      );
      return;
    }
    next();
  };
}

interface RateLimitEntry {
  readonly expiresAt: number;
  readonly count: number;
}

export function createRateLimitMiddleware(maximum: number) {
  const entries = new Map<string, RateLimitEntry>();

  return (request: HttpRequest, response: HttpResponse, next: NextFunction): void => {
    const now = Date.now();
    const key = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const existing = entries.get(key);
    const entry =
      existing === undefined || existing.expiresAt <= now
        ? { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS }
        : { count: existing.count + 1, expiresAt: existing.expiresAt };

    if (!entries.has(key) && entries.size >= MAXIMUM_RATE_LIMIT_KEYS) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey !== undefined) entries.delete(oldestKey);
    }
    entries.set(key, entry);

    const remaining = Math.max(0, maximum - entry.count);
    response.setHeader('X-RateLimit-Limit', maximum);
    response.setHeader('X-RateLimit-Remaining', remaining);

    if (entry.count > maximum) {
      const retryAfter = Math.max(1, Math.ceil((entry.expiresAt - now) / 1_000));
      response.statusCode = 429;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Retry-After', retryAfter);
      response.end(
        JSON.stringify({
          statusCode: 429,
          message: 'Too many requests',
          error: 'Too Many Requests',
        }),
      );
      return;
    }
    next();
  };
}
