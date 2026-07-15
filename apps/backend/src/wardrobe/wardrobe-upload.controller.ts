import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { WardrobeUploadService } from './wardrobe-upload.service';
import type { WardrobeUploadIntent } from './wardrobe-upload.types';

@Controller('customer/wardrobe')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class WardrobeUploadController {
  public constructor(
    @Inject(WardrobeUploadService)
    private readonly service: WardrobeUploadService,
  ) {}

  @Post('upload-intents')
  @HttpCode(HttpStatus.CREATED)
  public createUploadIntent(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<WardrobeUploadIntent> {
    return this.service.createUploadIntent(context, idempotencyKey, body);
  }
}
