import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
  HEALTH_READINESS_GATEWAY,
  type HealthReadinessGateway,
} from './health-readiness.gateway';

export interface HealthReadinessResponse {
  readonly service: 'vastra-backend';
  readonly status: 'ready';
  readonly scope: 'dependencies';
}

@Injectable()
export class HealthReadinessService {
  public constructor(
    @Inject(HEALTH_READINESS_GATEWAY)
    private readonly gateway: HealthReadinessGateway,
  ) {}

  public async getReadiness(): Promise<HealthReadinessResponse> {
    try {
      await this.gateway.probe();
    } catch {
      throw new ServiceUnavailableException({
        service: 'vastra-backend',
        status: 'unavailable',
        scope: 'dependencies',
      });
    }

    return {
      service: 'vastra-backend',
      status: 'ready',
      scope: 'dependencies',
    };
  }
}
