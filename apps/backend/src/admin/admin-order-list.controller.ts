import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminOrderListService } from './admin-order-list.service';
import type { ListAdminOperationalOrdersResponse } from './admin-order-list.types';

@Controller('admin/orders')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminOrderListController {
  public constructor(
    @Inject(AdminOrderListService)
    private readonly service: AdminOrderListService,
  ) {}

  @Get()
  @RequirePermissions('admin.orders.read')
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('queue') queue: unknown,
    @Query('status') status: unknown,
    @Query('shopId') shopId: unknown,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListAdminOperationalOrdersResponse> {
    return this.service.list(context, queue, status, shopId, cursor, limit);
  }
}
