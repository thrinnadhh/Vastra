import { Body, Controller, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CaptainPresenceService } from './captain-presence.service';
import type {
  CaptainAvailabilityResponse,
  CaptainLocationResponse,
} from './captain-presence.types';

@Controller('captain/me')
@AllowAccountTypes('CAPTAIN')
@RequireOperationalReadiness()
export class CaptainPresenceController {
  public constructor(
    @Inject(CaptainPresenceService)
    private readonly service: CaptainPresenceService,
  ) {}

  @Put('availability')
  @HttpCode(HttpStatus.OK)
  public setAvailability(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<CaptainAvailabilityResponse> {
    return this.service.setAvailability(context, body);
  }

  @Put('location')
  @HttpCode(HttpStatus.OK)
  public updateLocation(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<CaptainLocationResponse> {
    return this.service.updateLocation(context, body);
  }
}
