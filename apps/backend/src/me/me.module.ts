import { Module } from '@nestjs/common';

import { DeviceRegistrationController } from './device-registration.controller';
import { SupabaseDeviceRegistrationGateway } from './device-registration.gateway';
import { DeviceRegistrationService } from './device-registration.service';
import { DEVICE_REGISTRATION_GATEWAY } from './device-registration.tokens';
import { MeController } from './me.controller';
import { SupabaseMeGateway } from './me.gateway';
import { MeService } from './me.service';
import { ME_GATEWAY } from './me.tokens';

@Module({
  controllers: [MeController, DeviceRegistrationController],
  providers: [
    MeService,
    DeviceRegistrationService,
    {
      provide: ME_GATEWAY,
      useClass: SupabaseMeGateway,
    },
    {
      provide: DEVICE_REGISTRATION_GATEWAY,
      useClass: SupabaseDeviceRegistrationGateway,
    },
  ],
})
export class MeModule {}
