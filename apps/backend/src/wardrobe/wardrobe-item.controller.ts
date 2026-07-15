import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { WardrobeItemCreateService } from './wardrobe-item-create.service';
import type { WardrobeItem } from './wardrobe-item.types';

@Controller('customer/wardrobe/items')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class WardrobeItemController {
  public constructor(
    @Inject(WardrobeItemCreateService)
    private readonly createService: WardrobeItemCreateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<WardrobeItem> {
    return this.createService.create(context, idempotencyKey, body);
  }
}
