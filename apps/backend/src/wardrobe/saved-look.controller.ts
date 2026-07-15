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
import { SavedLookCartService, type CartTransferResult } from './saved-look-cart.service';
import { SavedLookDuplicationService } from './saved-look-duplication.service';
import { SavedLookService } from './saved-look.service';
import type { SavedLook, SavedLookList } from './saved-look.types';

@Controller('customer/looks')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class SavedLookController {
  public constructor(
    @Inject(SavedLookService)
    private readonly service: SavedLookService,
    @Inject(SavedLookDuplicationService)
    private readonly duplicationService: SavedLookDuplicationService,
    @Inject(SavedLookCartService)
    private readonly cartService: SavedLookCartService,
  ) {}

  @Get()
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<SavedLookList> {
    return this.service.list(context, cursor, limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<SavedLook> {
    return this.service.create(context, idempotencyKey, body);
  }

  @Post(':lookId/cart-items')
  @HttpCode(HttpStatus.OK)
  public addProductsToCart(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('lookId') lookId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<CartTransferResult> {
    return this.cartService.addProducts(context, lookId, idempotencyKey, body);
  }

  @Post(':lookId/duplicates')
  @HttpCode(HttpStatus.CREATED)
  public duplicate(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('lookId') lookId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<SavedLook> {
    return this.duplicationService.duplicate(context, lookId, idempotencyKey, body);
  }

  @Get(':lookId')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('lookId') lookId: unknown,
  ): Promise<SavedLook> {
    return this.service.get(context, lookId);
  }

  @Patch(':lookId')
  public update(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('lookId') lookId: unknown,
    @Body() body: unknown,
  ): Promise<SavedLook> {
    return this.service.update(context, lookId, body);
  }

  @Delete(':lookId')
  public delete(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('lookId') lookId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ): Promise<{ readonly success: true }> {
    return this.service.delete(context, lookId, idempotencyKey);
  }
}
