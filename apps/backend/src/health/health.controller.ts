import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

export interface HealthResponse {
  readonly service: 'vastra-backend';
  readonly status: 'ready';
  readonly scope: 'infrastructure';
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  public getHealth(): HealthResponse {
    return {
      service: 'vastra-backend',
      status: 'ready',
      scope: 'infrastructure',
    };
  }
}
