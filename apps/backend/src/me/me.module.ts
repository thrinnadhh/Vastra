import { Module } from '@nestjs/common';

import { CustomerProfileController } from './customer-profile.controller';
import { SupabaseCustomerProfileGateway } from './customer-profile.gateway';
import { CustomerProfileService } from './customer-profile.service';
import { CUSTOMER_PROFILE_GATEWAY } from './customer-profile.tokens';
import { DeviceRegistrationController } from './device-registration.controller';
import { SupabaseDeviceRegistrationGateway } from './device-registration.gateway';
import { DeviceRegistrationService } from './device-registration.service';
import { DEVICE_REGISTRATION_GATEWAY } from './device-registration.tokens';
import { MeController } from './me.controller';
import { SupabaseMeGateway } from './me.gateway';
import { MeService } from './me.service';
import { ME_GATEWAY } from './me.tokens';

@Module({
  controllers: [MeController, CustomerProfileController, DeviceRegistrationController],
  providers: [
    MeService,
    CustomerProfileService,
    DeviceRegistrationService,
    {
      provide: ME_GATEWAY,
      useClass: SupabaseMeGateway,
    },
    {
      provide: CUSTOMER_PROFILE_GATEWAY,
      useClass: SupabaseCustomerProfileGateway,
    },
    {
      provide: DEVICE_REGISTRATION_GATEWAY,
      useClass: SupabaseDeviceRegistrationGateway,
    },
  ],
})
export class MeModule {}
