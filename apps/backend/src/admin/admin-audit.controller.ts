import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminAuditService } from './admin-audit.service';
import { ADMIN_RESOURCE_TYPES, type AdminResourceType } from './admin.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return null;
  return value;
}

function optionalResourceType(value: unknown): AdminResourceType | null {
  if (typeof value !== 'string') return null;
  return ADMIN_RESOURCE_TYPES.includes(value as AdminResourceType)
    ? (value as AdminResourceType)
    : null;
}

function boundedLimit(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) return 50;
  return Math.min(100, Math.max(1, Number(value)));
}

@Controller('admin/audit')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminAuditController {
  public constructor(@Inject(AdminAuditService) private readonly service: AdminAuditService) {}

  @Get()
  @RequirePermissions('admin.audit.read')
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('resourceType') resourceType: unknown,
    @Query('resourceId') resourceId: unknown,
    @Query('actorId') actorId: unknown,
    @Query('limit') limit: unknown,
  ) {
    return this.service.list(context, {
      resourceType: optionalResourceType(resourceType),
      resourceId: optionalUuid(resourceId),
      actorId: optionalUuid(actorId),
      limit: boundedLimit(limit),
    });
  }
}
