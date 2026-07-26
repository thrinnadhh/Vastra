import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import {
  HealthReadinessService,
  type HealthReadinessResponse,
} from './health-readiness.service';

export interface HealthResponse {
  readonly service: 'vastra-backend';
  readonly status: 'ready';
  readonly scope: 'infrastructure';
}

@Public()
@Controller('health')
export class HealthController {
  public constructor(private readonly readinessService: HealthReadinessService) {}

  @Get()
  public getHealth(): HealthResponse {
    return {
      service: 'vastra-backend',
      status: 'ready',
      scope: 'infrastructure',
    };
  }

  @Get('ready')
  public getReadiness(): Promise<HealthReadinessResponse> {
    return this.readinessService.getReadiness();
  }
}
