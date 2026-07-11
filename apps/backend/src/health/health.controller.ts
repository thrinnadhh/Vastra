import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly service: 'vastra-backend';
  readonly status: 'ready';
  readonly scope: 'infrastructure';
}

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
