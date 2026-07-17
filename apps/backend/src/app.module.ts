import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { MerchantAlertDeliveryModule } from './merchant-alert-delivery/merchant-alert-delivery.module';
import { OrdersModule } from './orders/orders.module';
import { WardrobeModule } from './wardrobe/wardrobe.module';

@Module({
  imports: [
    AuthModule,
    CatalogueModule,
    DispatchModule,
    HealthModule,
    MeModule,
    MerchantAlertDeliveryModule,
    OrdersModule,
    WardrobeModule,
  ],
})
export class AppModule {}
