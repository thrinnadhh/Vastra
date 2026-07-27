import { Controller, Get, Inject } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import { AllowAdminAal1 } from '../auth/admin-mfa.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { AdminCapabilitiesService } from './admin-capabilities.service';
import type { GetAdminCapabilitiesResponse } from './admin-capabilities.types';

@Controller('admin')
@AllowAccountTypes('ADMIN')
export class AdminCapabilitiesController {
  public constructor(
    @Inject(AdminCapabilitiesService)
    private readonly service: AdminCapabilitiesService,
  ) {}

  @Get('capabilities')
  @AllowAdminAal1()
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<GetAdminCapabilitiesResponse> {
    return this.service.get(context);
  }
}
