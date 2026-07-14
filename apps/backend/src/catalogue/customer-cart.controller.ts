import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerCartService } from './customer-cart.service';
import type { CustomerCartResponse } from './customer-cart.types';

@Controller('customer/cart')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerCartController {
  public constructor(
    @Inject(CustomerCartService)
    private readonly cartService: CustomerCartService,
  ) {}

  @Get()
  public getCart(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<CustomerCartResponse> {
    return this.cartService.getCart(context);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  public setItem(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<CustomerCartResponse> {
    return this.cartService.setItem(context, body);
  }

  @Patch('items/:cartItemId')
  public updateItem(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cartItemId') cartItemId: unknown,
    @Body() body: unknown,
  ): Promise<CustomerCartResponse> {
    return this.cartService.updateItem(context, cartItemId, body);
  }

  @Delete('items/:cartItemId')
  public removeItem(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cartItemId') cartItemId: unknown,
  ): Promise<CustomerCartResponse> {
    return this.cartService.removeItem(context, cartItemId);
  }

  @Delete()
  public clearCart(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<CustomerCartResponse> {
    return this.cartService.clearCart(context);
  }
}
