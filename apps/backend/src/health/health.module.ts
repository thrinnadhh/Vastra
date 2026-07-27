import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import {
  HEALTH_READINESS_GATEWAY,
  SupabaseHealthReadinessGateway,
} from './health-readiness.gateway';
import { HealthReadinessService } from './health-readiness.service';

@Module({
  controllers: [HealthController],
  providers: [
    HealthReadinessService,
    {
      provide: HEALTH_READINESS_GATEWAY,
      useClass: SupabaseHealthReadinessGateway,
    },
  ],
})
export class HealthModule {}
