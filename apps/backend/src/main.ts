import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import {
  type BackendBootstrapConfiguration,
  loadBackendBootstrapConfiguration,
} from './bootstrap/bootstrap.configuration';
import { configureBackendApplication } from './bootstrap/configure-application';
import { StructuredLogger } from './bootstrap/structured-logger';

export async function createBackendApplication(
  configuration: BackendBootstrapConfiguration = loadBackendBootstrapConfiguration(),
): Promise<INestApplication> {
  const logger = new StructuredLogger();
  const application = await NestFactory.create(AppModule, { logger });

  configureBackendApplication(application, configuration, logger);
  return application;
}

export async function startBackend(): Promise<void> {
  const configuration = loadBackendBootstrapConfiguration();
  const application = await createBackendApplication(configuration);
  await application.listen(configuration.port, '0.0.0.0');
}

if (require.main === module) {
  void startBackend().catch((error: unknown) => {
    const logger = new StructuredLogger();
    logger.fatal({
      event: 'application.start.failed',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exitCode = 1;
  });
}
