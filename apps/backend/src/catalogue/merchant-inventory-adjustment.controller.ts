import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantInventoryAdjustmentService } from './merchant-inventory-adjustment.service';
import type {
  ListMerchantInventoryMovementsResponse,
  MerchantInventoryAdjustmentResponse,
} from './merchant-inventory-adjustment.types';

@Controller('merchant/inventory')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantInventoryAdjustmentController {
  public constructor(
    @Inject(MerchantInventoryAdjustmentService)
    private readonly adjustmentService: MerchantInventoryAdjustmentService,
  ) {}

  @Post('adjustments')
  @HttpCode(HttpStatus.OK)
  public adjustInventory(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<MerchantInventoryAdjustmentResponse> {
    return this.adjustmentService.adjustInventory(context, idempotencyKey, body);
  }

  @Get('movements')
  public listMovements(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('variantId') variantId: unknown,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListMerchantInventoryMovementsResponse> {
    return this.adjustmentService.listMovements(context, variantId, cursor, limit);
  }
}
