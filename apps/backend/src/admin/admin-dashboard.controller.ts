import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminDashboardController {
  public constructor(
    @Inject(AdminDashboardService)
    private readonly service: AdminDashboardService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('admin.dashboard.read')
  public getSummary(@CurrentAuthContext() context: AuthenticatedRequestContext) {
    return this.service.getSummary(context);
  }

  @Get('search')
  @RequirePermissions('admin.dashboard.read')
  public search(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('q') query: unknown,
    @Query('limit') limit: unknown,
  ) {
    return this.service.search(context, query, limit);
  }
}
