import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { HealthReadinessGateway } from './health-readiness.gateway';
import { HealthReadinessService } from './health-readiness.service';

class GatewayStub implements HealthReadinessGateway {
  public available = true;

  public probe(): Promise<void> {
    return this.available ? Promise.resolve() : Promise.reject(new Error('database offline'));
  }
}

describe('HealthReadinessService', () => {
  it('reports ready only after the database probe succeeds', async () => {
    const gateway = new GatewayStub();
    const service = new HealthReadinessService(gateway);

    await expect(service.getReadiness()).resolves.toStrictEqual({
      service: 'vastra-backend',
      status: 'ready',
      scope: 'dependencies',
    });
  });

  it('returns a sanitized 503 response when the database is unavailable', async () => {
    const gateway = new GatewayStub();
    gateway.available = false;
    const service = new HealthReadinessService(gateway);

    const request = service.getReadiness();

    await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(request).rejects.toMatchObject({
      response: {
        service: 'vastra-backend',
        status: 'unavailable',
        scope: 'dependencies',
      },
    });
  });
});
