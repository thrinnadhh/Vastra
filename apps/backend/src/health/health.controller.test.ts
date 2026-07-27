import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller';
import type { HealthReadinessService } from './health-readiness.service';

describe('HealthController', () => {
  const readinessService = {
    getReadiness: () =>
      Promise.resolve({
        service: 'vastra-backend',
        status: 'ready',
        scope: 'dependencies',
      } as const),
  } as HealthReadinessService;

  it('returns static infrastructure readiness metadata', () => {
    const controller = new HealthController(readinessService);

    expect(controller.getHealth()).toStrictEqual({
      service: 'vastra-backend',
      status: 'ready',
      scope: 'infrastructure',
    });
  });

  it('does not expose environment or credential fields', () => {
    const controller = new HealthController(readinessService);
    const response = controller.getHealth();

    expect(response).not.toHaveProperty('environment');
    expect(response).not.toHaveProperty('databaseUrl');
    expect(response).not.toHaveProperty('supabaseKey');
    expect(response).not.toHaveProperty('credentials');
  });

  it('delegates dependency readiness to the live probe', async () => {
    const controller = new HealthController(readinessService);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      scope: 'dependencies',
    });
  });
});
