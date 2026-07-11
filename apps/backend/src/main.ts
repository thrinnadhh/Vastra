import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const DEFAULT_PORT = 8080;
const MINIMUM_PORT = 1;
const MAXIMUM_PORT = 65_535;

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
  const application = await NestFactory.create(AppModule);

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
