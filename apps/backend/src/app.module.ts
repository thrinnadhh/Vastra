import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { OrdersModule } from './orders/orders.module';
import { WardrobeModule } from './wardrobe/wardrobe.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 300,
      },
    ]),
    AuthModule,
    CatalogueModule,
    DispatchModule,
    HealthModule,
    MeModule,
    OrdersModule,
    WardrobeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
