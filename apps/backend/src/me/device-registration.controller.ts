import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { DeviceRegistrationService } from './device-registration.service';
import type { RegisterDeviceResponse } from './device-registration.types';

@Controller('me/devices')
export class DeviceRegistrationController {
  public constructor(
    @Inject(DeviceRegistrationService)
    private readonly deviceRegistrationService: DeviceRegistrationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public registerDevice(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<RegisterDeviceResponse> {
    return this.deviceRegistrationService.registerDevice(context, body);
  }
}
