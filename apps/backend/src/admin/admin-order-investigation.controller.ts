import { Controller, Get, Inject, Param } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminOrderInvestigationService } from './admin-order-investigation.service';

@Controller('admin/orders')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminOrderInvestigationController {
  public constructor(
    @Inject(AdminOrderInvestigationService)
    private readonly service: AdminOrderInvestigationService,
  ) {}

  @Get(':orderId/investigation')
  @RequirePermissions('admin.orders.read')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ) {
    return this.service.get(context, orderId);
  }
}
