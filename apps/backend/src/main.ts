import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import {
  createJsonContentTypeMiddleware,
  createRateLimitMiddleware,
  createRequestIdMiddleware,
  createSecurityHeadersMiddleware,
  isAllowedCorsOrigin,
  loadHttpRuntimeConfiguration,
} from './http-runtime';

const DEFAULT_PORT = 8080;
const MINIMUM_PORT = 1;
const MAXIMUM_PORT = 65_535;

interface BackendHttpApplication {
  enableCors(options: {
    readonly allowedHeaders: readonly string[];
    readonly credentials: boolean;
    readonly exposedHeaders: readonly string[];
    readonly maxAge: number;
    readonly methods: readonly string[];
    readonly origin: (
      origin: string | undefined,
      callback: (error: null, allowed: boolean) => void,
    ) => void;
  }): void;
  enableShutdownHooks(): void;
  getHttpAdapter(): {
    getInstance(): {
      disable(name: string): void;
      set(name: string, value: number): void;
    };
  };
  listen(port: number): Promise<unknown>;
  setGlobalPrefix(prefix: string): void;
  use(middleware: unknown): void;
  useBodyParser(type: 'json', options: { readonly limit: string }): void;
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

async function bootstrap(port: number): Promise<void> {
  const configuration = loadHttpRuntimeConfiguration();
  const application = (await NestFactory.create(AppModule, {
    bodyParser: false,
    rawBody: true,
  })) as unknown as BackendHttpApplication;
  const server = application.getHttpAdapter().getInstance();

  server.disable('x-powered-by');
  if (configuration.trustProxyHops > 0) {
    server.set('trust proxy', configuration.trustProxyHops);
  }
  application.use(createSecurityHeadersMiddleware(configuration.production));
  application.use(createRequestIdMiddleware());
  application.use(createJsonContentTypeMiddleware());
  application.use(createRateLimitMiddleware(configuration.rateLimitMax));
  application.useBodyParser('json', { limit: configuration.bodyLimit });
  application.enableCors({
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    credentials: true,
    exposedHeaders: ['Retry-After', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin, configuration.allowedOrigins));
    },
  });
  application.enableShutdownHooks();
  application.setGlobalPrefix('v1');

  await application.listen(port);
}

function startBackend(): void {
  let port: number;

  try {
    port = resolvePort(process.env['PORT']);
  } catch {
    console.error('Invalid environment configuration: PORT');
    process.exitCode = 1;
    return;
  }

  void bootstrap(port).catch(() => {
    console.error('Vastra backend failed to start.');
    process.exitCode = 1;
  });
}

startBackend();
