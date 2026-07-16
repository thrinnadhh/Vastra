import type { INestApplication, LoggerService } from '@nestjs/common';
import helmet from 'helmet';

import type { BackendBootstrapConfiguration } from './bootstrap.configuration';
import { ApiExceptionFilter } from './api-exception.filter';
import { createRequestContextMiddleware, RequestIdInterceptor } from './request-id';

export function configureBackendApplication(
  application: INestApplication,
  configuration: BackendBootstrapConfiguration,
  logger: LoggerService,
): void {
  application.setGlobalPrefix('v1');
  application.use(createRequestContextMiddleware(logger));
  application.use(helmet());
  application.enableCors({
    origin: [...configuration.corsAllowedOrigins],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 600,
  });

  application.useGlobalInterceptors(new RequestIdInterceptor());
  application.useGlobalFilters(new ApiExceptionFilter(logger));
  application.enableShutdownHooks();

  const httpServer = application.getHttpAdapter().getInstance() as {
    set(setting: string, value: number): void;
  };
  httpServer.set('trust proxy', 1);
}
