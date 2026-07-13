import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [AuthModule, CatalogueModule, HealthModule, MeModule],
})
export class AppModule {}
