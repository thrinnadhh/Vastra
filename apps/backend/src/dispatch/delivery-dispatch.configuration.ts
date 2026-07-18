import { hostname } from 'node:os';

export interface DeliveryDispatchConfiguration {
  readonly enabled: boolean;
  readonly workerId: string;
  readonly pollIntervalMs: number;
  readonly dueTaskLimit: number;
  readonly initialRadiusMeters: number;
  readonly radiusStepMeters: number;
  readonly maxRadiusMeters: number;
  readonly captainsPerWave: number;
  readonly offerLifetimeSeconds: number;
  readonly waveIntervalSeconds: number;
}

function parseBoolean(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Invalid environment configuration: DELIVERY_DISPATCH_ENABLED');
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
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid environment configuration: ${name}`);
  }
  return value;
}

function parseWorkerId(environment: NodeJS.ProcessEnv): string {
  const configured = environment['DELIVERY_DISPATCH_WORKER_ID']?.trim();
  const value =
    configured === undefined || configured.length === 0 ? `backend-${hostname()}` : configured;
  if (!/^[A-Za-z0-9._:-]{3,100}$/u.test(value)) {
    throw new Error('Invalid environment configuration: DELIVERY_DISPATCH_WORKER_ID');
  }
  return value;
}

export function loadDeliveryDispatchConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): DeliveryDispatchConfiguration {
  const initialRadiusMeters = parseInteger(
    environment,
    'DELIVERY_DISPATCH_INITIAL_RADIUS_METERS',
    2_000,
    100,
    50_000,
  );
  const maxRadiusMeters = parseInteger(
    environment,
    'DELIVERY_DISPATCH_MAX_RADIUS_METERS',
    8_000,
    initialRadiusMeters,
    100_000,
  );
  return {
    enabled: parseBoolean(environment['DELIVERY_DISPATCH_ENABLED']),
    workerId: parseWorkerId(environment),
    pollIntervalMs: parseInteger(
      environment,
      'DELIVERY_DISPATCH_POLL_INTERVAL_MS',
      5_000,
      1_000,
      60_000,
    ),
    dueTaskLimit: parseInteger(environment, 'DELIVERY_DISPATCH_DUE_TASK_LIMIT', 10, 1, 100),
    initialRadiusMeters,
    radiusStepMeters: parseInteger(
      environment,
      'DELIVERY_DISPATCH_RADIUS_STEP_METERS',
      2_000,
      100,
      50_000,
    ),
    maxRadiusMeters,
    captainsPerWave: parseInteger(environment, 'DELIVERY_DISPATCH_CAPTAINS_PER_WAVE', 3, 1, 20),
    offerLifetimeSeconds: parseInteger(
      environment,
      'DELIVERY_DISPATCH_OFFER_LIFETIME_SECONDS',
      30,
      5,
      300,
    ),
    waveIntervalSeconds: parseInteger(
      environment,
      'DELIVERY_DISPATCH_WAVE_INTERVAL_SECONDS',
      30,
      5,
      300,
    ),
  };
}
