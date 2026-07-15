import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { WardrobeItemCreateService } from './wardrobe-item-create.service';
import { WardrobeItemManagementService } from './wardrobe-item-management.service';
import type { WardrobeItem, WardrobeItemList } from './wardrobe-item.types';

@Controller('customer/wardrobe/items')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class WardrobeItemController {
  public constructor(
    @Inject(WardrobeItemCreateService)
    private readonly createService: WardrobeItemCreateService,
    @Inject(WardrobeItemManagementService)
    private readonly managementService: WardrobeItemManagementService,
  ) {}

  @Get()
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<WardrobeItemList> {
    return this.managementService.list(context, cursor, limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<WardrobeItem> {
    return this.createService.create(context, idempotencyKey, body);
  }

  @Get(':wardrobeItemId')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('wardrobeItemId') wardrobeItemId: unknown,
  ): Promise<WardrobeItem> {
    return this.managementService.get(context, wardrobeItemId);
  }

  @Patch(':wardrobeItemId')
  public update(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('wardrobeItemId') wardrobeItemId: unknown,
    @Body() body: unknown,
  ): Promise<WardrobeItem> {
    return this.managementService.update(context, wardrobeItemId, body);
  }

  @Delete(':wardrobeItemId')
  @HttpCode(HttpStatus.OK)
  public delete(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('wardrobeItemId') wardrobeItemId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ): Promise<{ readonly success: true }> {
    return this.managementService.delete(context, wardrobeItemId, idempotencyKey);
  }
}
