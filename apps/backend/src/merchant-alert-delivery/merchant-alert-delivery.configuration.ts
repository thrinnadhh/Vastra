import { hostname } from 'node:os';

export interface FirebaseServiceAccountConfiguration {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

export interface MerchantAlertDeliveryConfiguration {
  readonly enabled: boolean;
  readonly workerId: string;
  readonly pollIntervalMs: number;
  readonly batchSize: number;
  readonly requestTimeoutMs: number;
  readonly credentials: FirebaseServiceAccountConfiguration | null;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

function parseEnabled(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Invalid environment configuration: MERCHANT_ALERT_DELIVERY_ENABLED');
}

function parseInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }

  return parsed;
}

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }
  return value;
}

function requireEmail(environment: NodeJS.ProcessEnv, name: string): string {
  const value = requireValue(environment, name);
  if (!value.includes('@')) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }
  return value;
}

function loadCredentials(
  environment: NodeJS.ProcessEnv,
  enabled: boolean,
): FirebaseServiceAccountConfiguration | null {
  if (!enabled) return null;

  const privateKey = requireValue(environment, 'FCM_PRIVATE_KEY').replace(/\\n/gu, '\n');
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Invalid environment configuration: FCM_PRIVATE_KEY');
  }

  return {
    projectId: requireValue(environment, 'FCM_PROJECT_ID'),
    clientEmail: requireEmail(environment, 'FCM_CLIENT_EMAIL'),
    privateKey,
  };
}

export function loadMerchantAlertDeliveryConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): MerchantAlertDeliveryConfiguration {
  const enabled = parseEnabled(environment['MERCHANT_ALERT_DELIVERY_ENABLED']);
  const configuredWorkerId = environment['MERCHANT_ALERT_DELIVERY_WORKER_ID']?.trim();

  return {
    enabled,
    workerId:
      configuredWorkerId !== undefined && configuredWorkerId.length > 0
        ? configuredWorkerId
        : `${hostname()}:${process.pid}`,
    pollIntervalMs: parseInteger(
      environment,
      'MERCHANT_ALERT_DELIVERY_POLL_INTERVAL_MS',
      DEFAULT_POLL_INTERVAL_MS,
      1_000,
      60_000,
    ),
    batchSize: parseInteger(
      environment,
      'MERCHANT_ALERT_DELIVERY_BATCH_SIZE',
      DEFAULT_BATCH_SIZE,
      1,
      100,
    ),
    requestTimeoutMs: parseInteger(
      environment,
      'MERCHANT_ALERT_DELIVERY_REQUEST_TIMEOUT_MS',
      DEFAULT_REQUEST_TIMEOUT_MS,
      1_000,
      30_000,
    ),
    credentials: loadCredentials(environment, enabled),
  };
}
