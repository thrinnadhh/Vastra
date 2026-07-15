import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [AuthModule, CatalogueModule, DispatchModule, HealthModule, MeModule, OrdersModule],
})
export class AppModule {}
