import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { CustomerAddressModule } from './addresses/customer-address.module';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { CustomerReturnsModule } from './finance/customer-returns.module';
import { FinanceLedgerModule } from './finance/finance-ledger.module';
import { PaymentModule } from './finance/payment.module';
import { ReturnResolutionModule } from './finance/return-resolution.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { MerchantAlertDeliveryModule } from './merchant-alert-delivery/merchant-alert-delivery.module';
import { MerchantAlertObservabilityModule } from './merchant-alert-observability/merchant-alert-observability.module';
import { OrdersModule } from './orders/orders.module';
import { WardrobeModule } from './wardrobe/wardrobe.module';

@Module({
  imports: [
    AdminModule,
    CustomerAddressModule,
    AuthModule,
    CatalogueModule,
    DispatchModule,
    CustomerReturnsModule,
    FinanceLedgerModule,
    PaymentModule,
    ReturnResolutionModule,
    HealthModule,
    MeModule,
    MerchantAlertDeliveryModule,
    MerchantAlertObservabilityModule,
    OrdersModule,
    WardrobeModule,
  ],
})
export class AppModule {}
