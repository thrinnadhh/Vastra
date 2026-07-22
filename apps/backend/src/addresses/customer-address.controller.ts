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
  Put,
} from '@nestjs/common';
import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerAddressService } from './customer-address.service';
import type {
  CustomerAddressResponse,
  DeleteCustomerAddressResponse,
  ListCustomerAddressesResponse,
} from './customer-address.types';

@Controller('customer/addresses')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerAddressController {
  public constructor(
    @Inject(CustomerAddressService) private readonly service: CustomerAddressService,
  ) {}
  @Get() public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<ListCustomerAddressesResponse> {
    return this.service.list(context);
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') key: unknown,
    @Body() body: unknown,
  ): Promise<CustomerAddressResponse> {
    return this.service.create(context, body, key);
  }
  @Get(':addressId') public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('addressId') id: unknown,
  ): Promise<CustomerAddressResponse> {
    return this.service.get(context, id);
  }
  @Patch(':addressId') public update(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('addressId') id: unknown,
    @Headers('idempotency-key') key: unknown,
    @Body() body: unknown,
  ): Promise<CustomerAddressResponse> {
    return this.service.update(context, id, body, key);
  }
  @Delete(':addressId') public remove(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('addressId') id: unknown,
    @Headers('idempotency-key') key: unknown,
  ): Promise<DeleteCustomerAddressResponse> {
    return this.service.remove(context, id, key);
  }
  @Put(':addressId/default') public setDefault(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('addressId') id: unknown,
    @Headers('idempotency-key') key: unknown,
  ): Promise<CustomerAddressResponse> {
    return this.service.setDefault(context, id, key);
  }
}
