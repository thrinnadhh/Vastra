import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminCaseService } from './admin-case.service';

@Controller('admin/cases')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminCaseController {
  public constructor(@Inject(AdminCaseService) private readonly service: AdminCaseService) {}

  @Get()
  @RequirePermissions('admin.cases.read')
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('status') status: unknown,
    @Query('priority') priority: unknown,
    @Query('assignedTo') assignedTo: unknown,
    @Query('limit') limit: unknown,
  ) {
    return this.service.list(context, status, priority, assignedTo, limit);
  }

  @Get(':caseId')
  @RequirePermissions('admin.cases.read')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
  ) {
    return this.service.get(context, caseId);
  }

  @Post()
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.create(context, idempotencyKey, requestId, body);
  }

  @Post(':caseId/assign')
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.OK)
  public assign(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.assign(context, caseId, idempotencyKey, requestId, body);
  }

  @Post(':caseId/notes')
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.OK)
  public addNote(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.addNote(context, caseId, idempotencyKey, requestId, body);
  }

  @Post(':caseId/escalate')
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.OK)
  public escalate(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.escalate(context, caseId, idempotencyKey, requestId, body);
  }

  @Post(':caseId/resolve')
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.OK)
  public resolve(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.resolve(context, caseId, idempotencyKey, requestId, body);
  }

  @Post(':caseId/close')
  @RequirePermissions('admin.cases.manage')
  @HttpCode(HttpStatus.OK)
  public close(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('caseId') caseId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.close(context, caseId, idempotencyKey, requestId, body);
  }
}
