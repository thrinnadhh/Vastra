import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns static infrastructure readiness metadata', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toStrictEqual({
      service: 'vastra-backend',
      status: 'ready',
      scope: 'infrastructure',
    });
  });

  it('does not expose environment or credential fields', () => {
    const controller = new HealthController();
    const response = controller.getHealth();

    expect(response).not.toHaveProperty('environment');
    expect(response).not.toHaveProperty('databaseUrl');
    expect(response).not.toHaveProperty('supabaseKey');
    expect(response).not.toHaveProperty('credentials');
  });
});
