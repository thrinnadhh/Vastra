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
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ReturnEvidenceService } from './return-evidence.service';

@Controller('returns')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerReturnEvidenceController {
  public constructor(
    @Inject(ReturnEvidenceService)
    private readonly service: ReturnEvidenceService,
  ) {}

  @Post(':returnId/evidence/upload-url')
  public createUploadAuthorization(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.createUploadAuthorization(context, returnId, body);
  }

  @Post(':returnId/evidence')
  @HttpCode(HttpStatus.CREATED)
  public finalize(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.finalize(context, returnId, body);
  }

  @Get(':returnId/evidence/:evidenceId/url')
  public createReadAuthorization(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Param('evidenceId') evidenceId: unknown,
  ) {
    return this.service.createReadAuthorization(context, returnId, evidenceId);
  }
}

@Controller('admin/returns')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminReturnPickupController {
  public constructor(
    @Inject(ReturnEvidenceService)
    private readonly service: ReturnEvidenceService,
  ) {}

  @Post(':returnId/assign-pickup')
  @RequirePermissions('admin.returns.manage')
  public assignPickup(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.assignPickup(context, returnId, idempotencyKey, body);
  }
}
