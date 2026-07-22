import { Body, Controller, Inject, Patch } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { CustomerProfileService } from './customer-profile.service';
import type { GetCurrentAccountResponse } from './me.types';

@Controller('me/profile')
@AllowAccountTypes('CUSTOMER')
export class CustomerProfileController {
  public constructor(
    @Inject(CustomerProfileService)
    private readonly customerProfileService: CustomerProfileService,
  ) {}

  @Patch()
  public updateCurrentCustomerProfile(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<GetCurrentAccountResponse> {
    return this.customerProfileService.updateCurrentCustomerProfile(context, body);
  }
}
